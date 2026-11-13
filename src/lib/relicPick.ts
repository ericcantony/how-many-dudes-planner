import { cellOf, columnById, givesToTeam, RELIC_GIVES, scales } from '../data/chart';
import { dudeById, familyById, relicById, tokensText, type Relic } from '../data/game';
import type { Comp } from './comp';
import type { Grade, Reason } from './flyer';
import { teamStats, TIMED_RULES, timedTargetIssue } from './stats';

/**
 * Relic stash helper: grade each offered Relic for combat, like the flyer helper does for Dudes.
 * The main signal is measured: add the Relic to the plan, recompute every Dude's stats, and compare
 * effective team damage and survivability. Everything else (reach, build fit, healer gap) adjusts that.
 */

export interface RelicGrade {
  relic: string;
  score: number;
  grade: Grade;
  reasons: Reason[];
  /** Measured change in Team DPS / Team HP, in percent (0 when not measurable). */
  dpsGain: number;
  hpGain: number;
}

const toGrade = (score: number): Grade => {
  if (score >= 4) return '++';
  if (score >= 1.5) return '+';
  if (score > -0.5) return '0';
  return '−';
};

const pct = (x: number) => `${Math.round(x * 10) / 10}%`;
const list = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Effective team survivability and damage from the same buffed stats the Roster rows show.
 * Survivability: HP divided by the share of damage that still lands after Toughness, Evasion and
 * Block (Deflection avoids the hit but sends half of it to an ally, so it counts half).
 * Damage: DPS with Crits counted as double damage and Cleave as extra hits.
 * These are rough models, good for comparing Relics, not exact in-game numbers.
 */
function teamTotals(comp: Comp) {
  const stats = teamStats(comp);
  let hp = 0;
  let dps = 0;
  for (const e of comp.roster) {
    const s = stats.get(e.key)?.stats ?? [];
    const v = (key: string) => s.find((x) => x.key === key)?.value ?? 0;
    const frac = (key: string) => Math.min(0.95, v(key) / 100);
    const landed = (1 - frac('toughness')) * (1 - frac('evasion')) * (1 - frac('block_chance')) * (1 - frac('deflection') / 2);
    hp += (v('hpmax') / Math.max(0.05, landed)) * e.count;
    dps += v('dps') * (1 + frac('crit_chance')) * (1 + v('cleave') / 100) * e.count;
  }
  return { hp, dps };
}

/** Change in Team DPS/HP if this Relic were planned, in percent. */
function measure(comp: Comp, relic: string) {
  const before = teamTotals(comp);
  const after = teamTotals({ ...comp, relics: [...comp.relics, relic] });
  const change = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);
  return { dps: change(after.dps, before.dps), hp: change(after.hp, before.hp) };
}

/** Which of your Dudes the Relic reaches: its own Dude Type, its Family, or everyone. */
function reachReasons(r: Relic, comp: Comp): { reasons: Reason[]; usable: boolean } {
  const total = comp.roster.reduce((s, e) => s + e.count, 0);
  const countIn = (pred: (dude: string) => boolean) => comp.roster.filter((e) => pred(e.dude)).reduce((s, e) => s + e.count, 0);
  if (r.scope === 'dude') {
    const mine = (r.dudes ?? []).filter((d) => comp.roster.some((e) => e.dude === d));
    const names = (r.dudes ?? []).map((d) => dudeById.get(d)?.name ?? d);
    if (!mine.length) return { usable: false, reasons: [{ delta: -4, text: `For ${list(names)}, who isn’t on your Roster.` }] };
    const n = countIn((d) => mine.includes(d));
    return { usable: true, reasons: [{ delta: 0, text: `For your ${list(mine.map((d) => dudeById.get(d)!.name))} (${n} of ${total} Dudes).` }] };
  }
  if (r.scope === 'family' && r.family) {
    const fam = familyById.get(r.family)?.name ?? r.family;
    const n = countIn((d) => dudeById.get(d)?.family === r.family);
    if (!n) return { usable: false, reasons: [{ delta: -3, text: `${fam} Family Relic, and you have no ${fam} Dudes.` }] };
    return { usable: true, reasons: [{ delta: 0.5, text: `${fam} Family Relic: reaches ${n} of your ${total} Dudes.` }] };
  }
  return { usable: true, reasons: [{ delta: 0.5, text: 'Works for any team.' }] };
}

/**
 * Stats it gives that your build cares about: focus stats, or stats your Dudes scale with.
 * For conditional Relics (effect only when something happens) these count half.
 */
function fitReasons(r: Relic, comp: Comp, conditional: boolean): Reason[] {
  const gives = RELIC_GIVES.get(r.id) ?? [];
  const types = [...new Set(comp.roster.map((e) => e.dude))];
  const out: Reason[] = [];
  const weight = conditional ? 0.5 : 1;
  const when = conditional ? ', only when it triggers' : '';
  const focus = gives.filter((c) => comp.focus.includes(c));
  if (focus.length) {
    out.push({
      delta: Math.min(2, focus.length) * weight,
      text: `Gives your focus stat${focus.length > 1 ? 's' : ''}: ${list(focus.map((c) => columnById.get(c)!.label))}${when}.`,
    });
  }
  const scaled = gives.filter((c) => !comp.focus.includes(c) && types.some((d) => scales(cellOf(d, c))));
  if (scaled.length) {
    const who = types.filter((d) => scaled.some((c) => scales(cellOf(d, c)))).map((d) => dudeById.get(d)!.name);
    const verb = who.length === 1 ? 'scales' : 'scale';
    out.push({ delta: weight, text: `Gives ${list(scaled.map((c) => columnById.get(c)!.label))}, which ${list(who)} ${verb} with${when}.` });
  }
  const healers = types.filter((d) => givesToTeam(cellOf(d, 'heal')));
  if (gives.includes('heal') && !healers.length && types.length) {
    out.push({ delta: 1.5 * weight, text: `Adds healing, and nobody on your team heals others yet${when}.` });
  }
  return out;
}

/** For Relics that buff the Dude Type next to their owner: who that is, and a hint when it's a small group. */
function positionReason(comp: Comp, relicName: string): Reason | null {
  const rule = TIMED_RULES[relicName];
  const dir = rule?.targets.find((t) => t === 'below' || t === 'above');
  if (!rule || !dir) return null;
  const i = comp.roster.findIndex((e) => e.dude === rule.owner);
  const target = comp.roster[dir === 'below' ? i + 1 : i - 1];
  if (i < 0 || !target) return null;
  const owner = dudeById.get(rule.owner)!.name;
  const name = dudeById.get(target.dude)!.name;
  const total = comp.roster.reduce((s, e) => s + e.count, 0);
  const biggest = Math.max(...comp.roster.map((e) => e.count));
  const small = target.count < biggest && target.count / total < 0.4;
  const who = target.count === 1 ? `your 1 ${name}` : `your ${target.count} ${name}s`;
  const hint = small ? ` Put a bigger group ${dir} him for more value.` : '';
  return { delta: 0, text: `Goes to ${who}, the Dude Type ${dir} ${owner}.${hint}` };
}

const ECONOMY = /\$|merchant|restock|stocked|price|shop/i;

export function gradeRelic(relicId: string, comp: Comp): RelicGrade {
  const r = relicById.get(relicId)!;
  const reasons: Reason[] = [];
  let dpsGain = 0;
  let hpGain = 0;

  if (comp.relics.includes(relicId)) {
    reasons.push({ delta: 0, text: 'Already in your Planned Relics.' });
  }
  const reach = reachReasons(r, comp);
  reasons.push(...reach.reasons);

  if (reach.usable && comp.roster.length) {
    // Measure against the plan without this Relic, so an already-planned one isn't counted twice.
    const m = measure({ ...comp, relics: comp.relics.filter((x) => x !== relicId) }, relicId);
    dpsGain = m.dps;
    hpGain = m.hp;
    if (dpsGain >= 0.5) reasons.push({ delta: Math.min(3, dpsGain / 4), text: `Team damage +${pct(dpsGain)} (DPS, Crit and Cleave, measured on your Roster).` });
    if (hpGain >= 0.5) reasons.push({ delta: Math.min(2.5, hpGain / 5), text: `Team survivability +${pct(hpGain)} (HP and damage avoided, measured on your Roster).` });
  }
  const measurable = dpsGain >= 0.5 || hpGain >= 0.5;
  if (measurable) reasons.push({ delta: 0.5, text: 'Always active: you get this in every battle.' });
  if (reach.usable && comp.roster.length) reasons.push(...fitReasons(r, comp, !measurable));

  // Relics that fire off a timed ability: explain a missing target, who gets it, or what's assumed.
  const timed = TIMED_RULES[r.name];
  const issue = reach.usable ? timedTargetIssue(comp, r.name) : null;
  if (issue) reasons.push({ delta: -1, text: issue });
  else if (timed && reach.usable) {
    reasons.push({ delta: 0, text: `Triggers reliably: ${timed.ability} fires on a timer.${timed.note ? ` ${timed.note}` : ''}` });
    const where = positionReason(comp, r.name);
    if (where) reasons.push(where);
  }

  const text = tokensText(r.desc);
  if (reach.usable && !measurable && !issue) {
    if (ECONOMY.test(text) && !(RELIC_GIVES.get(relicId) ?? []).length) {
      reasons.push({ delta: 0, text: 'Economy Relic: helps your money or shop, not combat directly.' });
    } else {
      reasons.push({ delta: 0, text: 'Its effect depends on battle (triggers, chances or timers), so it can’t be measured here. Read the text.' });
    }
  }

  const score = reasons.reduce((s, x) => s + x.delta, 0);
  return { relic: relicId, score, grade: toGrade(score), reasons: reasons.toSorted((a, b) => b.delta - a.delta), dpsGain, hpGain };
}
