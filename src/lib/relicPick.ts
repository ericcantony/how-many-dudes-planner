import { cellOf, columnById, givesToTeam, RELIC_GIVES, scales } from '../data/chart';
import { dudeById, familyById, relicById, tokensText, type Relic } from '../data/game';
import type { Comp } from './comp';
import type { Grade, Reason } from './flyer';
import { isConditional, POSITION_RELICS, positionTarget, slotLabel, teamStats, TIMED_RULES, timedTargetIssue } from './stats';

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
    if (!POSITION_RELICS[r.name]) {
      const n = countIn((d) => mine.includes(d));
      return { usable: true, reasons: [{ delta: 0, text: `For your ${list(mine.map((d) => dudeById.get(d)!.name))} (${n} of ${total} Dudes).` }] };
    }
  }
  // Position Relics buff one Roster slot (top, end, third, right below X), whatever its Family.
  const pos = POSITION_RELICS[r.name];
  if (pos) {
    const target = positionTarget(comp.roster, pos);
    if (!target) return { usable: false, reasons: [{ delta: -1, text: `Nothing ${slotLabel(pos)} yet, so it has no target.` }] };
    const name = dudeById.get(target.dude)!.name;
    const who = target.count === 1 ? `your 1 ${name}` : `your ${target.count} ${name}s`;
    const what = pos.effect ? `: ${pos.effect}` : '';
    return { usable: true, reasons: [{ delta: 0, text: `Only for ${who}, the Dude Type ${slotLabel(pos)}${what} (${target.count} of ${total} Dudes).` }] };
  }
  // A Family only says which pool the Relic comes from; its text decides who it affects, and no
  // Family Relic is limited to that Family's Dudes.
  if (r.scope === 'family' && r.family) {
    const fam = familyById.get(r.family)?.name ?? r.family;
    return { usable: true, reasons: [{ delta: 0.5, text: `Works for your whole team (from the ${fam} Family pool).` }] };
  }
  return { usable: true, reasons: [{ delta: 0.5, text: 'Works for any team.' }] };
}

/**
 * Stats it gives that your build cares about: focus stats, or stats your Dudes scale with.
 * For conditional Relics (effect only when something happens) these count half.
 */
/** Text that means a Dude Relic also reaches other Dudes (not "eats another Dude"). */
const REACHES_OTHERS = /\b(all (nearby )?Dudes|nearby Dudes|Roster Dudes?|any Dude|a Dude)\b/i;

/**
 * Whether the stats a Relic grants land on other Dudes. Only the recipients count: the subject
 * before "gains" ("The Frankendude gains…" = only him) or the object after "grants"
 * ("he grants all nearby Dudes…" = others). Other mentions ("donates HP to a Dude") don't.
 */
function grantsToOthers(r: Relic): boolean {
  const sentences = tokensText(r.desc).split(/(?<=\.)\s+/);
  return sentences.some((s) => {
    const subject = /^(.*?)\bgains?\b/i.exec(s)?.[1] ?? '';
    const object = /\bgrants?\b(.*?)(\d|$)/i.exec(s)?.[1] ?? '';
    return REACHES_OTHERS.test(subject) || REACHES_OTHERS.test(object);
  });
}

/**
 * Dude Types a Relic's bonuses actually land on. Global and Family Relics: everyone.
 * Dude Relics: that Dude, plus the Roster neighbour or other Dudes when a timed rule or the text says so.
 */
function reachedTypes(r: Relic, comp: Comp): { types: string[]; selfOnly: boolean } {
  const all = [...new Set(comp.roster.map((e) => e.dude))];
  const pos = POSITION_RELICS[r.name];
  if (pos) {
    const target = positionTarget(comp.roster, pos);
    return { types: target ? [target.dude] : [], selfOnly: false };
  }
  if (r.scope !== 'dude') return { types: all, selfOnly: false };
  const own = all.filter((d) => r.dudes?.includes(d));
  const rule = TIMED_RULES[r.name];
  if (rule?.targets.includes('spread') || grantsToOthers(r)) return { types: all, selfOnly: false };
  const extra: string[] = [];
  const i = comp.roster.findIndex((e) => e.dude === rule?.owner);
  if (rule && i >= 0) {
    if (rule.targets.includes('below') && comp.roster[i + 1]) extra.push(comp.roster[i + 1].dude);
    if (rule.targets.includes('above') && comp.roster[i - 1]) extra.push(comp.roster[i - 1].dude);
  }
  return { types: [...new Set([...own, ...extra])], selfOnly: extra.length === 0 };
}

function fitReasons(r: Relic, comp: Comp, conditional: boolean): Reason[] {
  const gives = RELIC_GIVES.get(r.id) ?? [];
  const { types, selfOnly } = reachedTypes(r, comp);
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
  // Only healing that reaches other Dudes fills the team's healer gap (not a Dude healing himself).
  const team = [...new Set(comp.roster.map((e) => e.dude))];
  const healers = team.filter((d) => givesToTeam(cellOf(d, 'heal')));
  if (gives.includes('heal') && !selfOnly && !healers.length && team.length) {
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

/** Where Summoned Dudes come from: Dudes whose ability summons, and planned Relics that summon at battle start or on KO. */
const SUMMON_DUDES: Record<string, string> = { necromancer: 'Skeledudes', quantum: 'Echo Dudes' };
const SUMMON_RELICS: Record<string, string> = { 'Ancient Sword': 'Skeledudes', 'Living Hand': 'Skeledudes', Gravestone: 'Skeledudes' };

function summonSources(comp: Comp): string[] {
  const fromDudes = comp.roster
    .filter((e) => SUMMON_DUDES[e.dude])
    .map((e) => `${SUMMON_DUDES[e.dude]} from your ${dudeById.get(e.dude)!.name}`);
  const fromRelics = comp.relics
    .map((id) => relicById.get(id)?.name ?? '')
    .filter((n) => SUMMON_RELICS[n])
    .map((n) => `${SUMMON_RELICS[n]} from ${n}`);
  return [...fromDudes, ...fromRelics];
}

/** Relic-specific checks the general rules can't see. */
const SPECIAL_REASONS: Record<string, (comp: Comp) => Reason> = {
  // "He simply eats another Dude… preferring to eat Summoned Dudes": without summons he eats a real one.
  'Jaw Implant': (comp) => {
    const sources = summonSources(comp);
    return sources.length
      ? { delta: 0.5, text: `He eats a Summoned Dude first (${list(sources)}), not one of your real Dudes.` }
      : { delta: -1.5, text: 'No Summoned Dudes on your team, so he’d eat one of your real Dudes.' };
  },
};

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
  // Conditional comes from the text ("When…", "chance"), not from whether we could measure it.
  const conditional = !measurable && isConditional(r.desc);
  if (measurable) reasons.push({ delta: 0.5, text: 'Always active: you get this in every battle.' });
  if (reach.usable && comp.roster.length) reasons.push(...fitReasons(r, comp, conditional));

  const special = reach.usable ? SPECIAL_REASONS[r.name]?.(comp) : undefined;
  if (special) reasons.push(special);

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
    const gives = RELIC_GIVES.get(relicId) ?? [];
    if (ECONOMY.test(text) && !gives.length) {
      reasons.push({ delta: 0, text: 'Economy Relic: helps your money or shop, not combat directly.' });
    } else if (!conditional) {
      const what = gives.length ? list(gives.map((c) => columnById.get(c)!.label)) : 'its effect';
      reasons.push({ delta: 0.5, text: `Always active, but ${what} isn’t counted in these numbers. Read the text.` });
    } else {
      reasons.push({ delta: 0, text: 'Its effect depends on battle (triggers, chances or timers), so it can’t be measured here. Read the text.' });
    }
  }

  const score = reasons.reduce((s, x) => s + x.delta, 0);
  return { relic: relicId, score, grade: toGrade(score), reasons: reasons.toSorted((a, b) => b.delta - a.delta), dpsGain, hpGain };
}
