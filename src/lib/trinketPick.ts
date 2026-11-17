import { cellOf, columnById, scales, TRINKET_GIVES } from '../data/chart';
import { dudeById, trinketById } from '../data/game';
import type { Comp } from './comp';
import type { Grade, Reason } from './flyer';
import { teamTotals } from './relicPick';
import { isConditional } from './stats';
import { healsTeam } from './synergy';

/**
 * Trinket stash helper: like the Relic stash, but a Trinket goes on one Dude Type (every copy of
 * that type is a Wielder). So each offered Trinket is graded on every Roster type, and the best
 * holder is recommended. The main signal is measured: equip it there, recompute the team's stats,
 * and compare effective damage and survivability (replacing that type's current Trinket counts).
 */

type Entry = Comp['roster'][number];

export interface HolderGrade {
  /** Roster entry key of the Dude Type that would hold it. */
  key: string;
  dude: string;
  score: number;
  grade: Grade;
  reasons: Reason[];
}

export interface HoldGrade {
  item: string;
  /** Best holder first. Empty when the Roster is empty. */
  holders: HolderGrade[];
}

export const toGrade = (score: number): Grade => {
  if (score >= 4) return '++';
  if (score >= 1.5) return '+';
  if (score > -0.5) return '0';
  return '−';
};

const pct = (x: number) => `${Math.round(x * 10) / 10}%`;
const list = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const nameOf = (dude: string) => dudeById.get(dude)?.name ?? dude;
const group = (e: Entry) => (e.count === 1 ? `your 1 ${nameOf(e.dude)}` : `your ${e.count} ${nameOf(e.dude)}s`);

/** Change in Team DPS/HP (percent) if this entry changed (e.g. held another Trinket or meal). */
export function measureSwap(comp: Comp, key: string, change: Partial<Entry>) {
  const before = teamTotals(comp);
  const after = teamTotals({ ...comp, roster: comp.roster.map((e) => (e.key === key ? { ...e, ...change } : e)) });
  const pctChange = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : 0);
  return { dps: pctChange(after.dps, before.dps), hp: pctChange(after.hp, before.hp) };
}

/** Reasons for a measured change in Team damage and survivability. */
export function measuredReasons(m: { dps: number; hp: number }): Reason[] {
  const out: Reason[] = [];
  if (m.dps >= 0.5) out.push({ delta: Math.min(3, m.dps / 4), text: `Team damage +${pct(m.dps)} (DPS, Crit and Cleave, measured on your Roster).` });
  if (m.dps <= -0.5) out.push({ delta: Math.max(-3, m.dps / 4), text: `Team damage ${pct(m.dps)} (measured on your Roster).` });
  if (m.hp >= 0.5) out.push({ delta: Math.min(2.5, m.hp / 5), text: `Team survivability +${pct(m.hp)} (HP and damage avoided, measured on your Roster).` });
  if (m.hp <= -0.5) out.push({ delta: Math.max(-2.5, m.hp / 5), text: `Team survivability ${pct(m.hp)} (measured on your Roster).` });
  return out;
}

/**
 * Trinkets whose value depends on where the Wielder sits or how big his group is, which the stat
 * model can't see. Each returns a reason for one holder.
 */
const SPECIAL: Record<string, (comp: Comp, i: number) => Reason> = {
  // "gains 30% Toughness and 30% Attack Power but loses 50% Run Speed": the stats are measured, the loss isn't.
  'Weighted Vest': () => ({ delta: -0.5, text: 'He also loses 50% Run Speed, so he reaches the fight later (not in the numbers).' }),
  // "Dudes adjacent to the Wielder … gain 1% Crit Chance and 1% Evasion for every 2 Wielders".
  Rizz: (comp, i) => {
    const e = comp.roster[i];
    const near = [comp.roster[i - 1], comp.roster[i + 1]].filter(Boolean);
    if (!near.length) return { delta: -1.5, text: 'Buffs the Dude Types next to him, and he has no neighbours.' };
    const stacks = Math.min(10, Math.floor(e.count / 2));
    const who = list(near.map((n) => nameOf(n.dude)));
    return { delta: Math.min(2, stacks / 4), text: `Gives ${who} +${stacks}% Crit Chance and Evasion (1% per 2 Wielders, up to 10).` };
  },
  // "teleport a random Dude of the Dude Type below him … and grant him 20% Attack Speed".
  'Laser Pointer': (comp, i) => {
    const below = comp.roster[i + 1];
    if (!below) return { delta: -1.5, text: 'Buffs the Dude Type below him, and nothing is below him.' };
    return { delta: 0.5, text: `Sends ${nameOf(below.dude)} (below him) into battle with bursts of Attack Speed.` };
  },
  // "3% Attack Power and 1% Max HP multiplied by the difference between the most prevalent type and his".
  Fedora: (comp, i) => {
    const biggest = Math.max(...comp.roster.map((e) => e.count));
    const diff = biggest - comp.roster[i].count;
    if (diff <= 0) return { delta: -1, text: 'He’s your biggest group, so the difference is 0 and it gives nothing.' };
    return {
      delta: Math.min(2.5, diff / 8),
      text: `${diff} fewer than your biggest group: +${diff * 3}% Attack Power, +${diff}% Max HP for each Wielder. Best on a small group.`,
    };
  },
  // "1% of a stat per Wielder on your Roster, stacking up to 40 times. Top: Attack Power, bottom: Max HP, else Multistrike."
  'Team Jersey': (comp, i) => {
    const e = comp.roster[i];
    const stacks = Math.min(40, e.count);
    let stat = 'Multistrike';
    if (i === 0) stat = 'Attack Power';
    else if (i === comp.roster.length - 1) stat = 'Max HP';
    // The stat itself is counted in stats.ts, so this only explains it.
    return { delta: 0, text: `+${stacks}% ${stat} for each of ${group(e)} (1% per Wielder, up to 40; set by his Roster slot).` };
  },
};

function fitReasons(comp: Comp, e: Entry, gives: string[], conditional: boolean): Reason[] {
  const out: Reason[] = [];
  const weight = conditional ? 0.5 : 1;
  const when = conditional ? ', only when it triggers' : '';
  const own = gives.filter((c) => c !== 'heal');
  const focus = own.filter((c) => comp.focus.includes(c));
  if (focus.length) {
    out.push({ delta: Math.min(2, focus.length) * weight, text: `Gives ${group(e)} your focus stat${focus.length > 1 ? 's' : ''}: ${list(focus.map((c) => columnById.get(c)!.label))}${when}.` });
  }
  const scaled = own.filter((c) => !comp.focus.includes(c) && scales(cellOf(e.dude, c)));
  if (scaled.length) {
    out.push({ delta: weight, text: `${nameOf(e.dude)} scales with ${list(scaled.map((c) => columnById.get(c)!.label))}${when}.` });
  }
  const team = [...new Set(comp.roster.map((x) => x.dude))];
  if (gives.includes('heal') && !team.some((d) => healsTeam(d, comp.relics))) {
    out.push({ delta: 1.5 * weight, text: `Heals the team, and nobody on your team heals others yet${when}.` });
  }
  return out;
}

function gradeHolder(comp: Comp, trinketId: string, i: number): HolderGrade {
  const t = trinketById.get(trinketId)!;
  const e = comp.roster[i];
  const reasons: Reason[] = [];
  const current = e.trinket ? trinketById.get(e.trinket) : null;
  if (e.trinket === trinketId) reasons.push({ delta: 0, text: `${nameOf(e.dude)} already holds it.` });
  else if (current) reasons.push({ delta: -0.5, text: `Replaces his ${current.name} (counted in the numbers).` });

  // Measure against the Roster without this Trinket on him, so a held one isn't compared with itself.
  const base = e.trinket === trinketId ? { ...comp, roster: comp.roster.map((x) => (x.key === e.key ? { ...x, trinket: null } : x)) } : comp;
  const m = measureSwap(base, e.key, { trinket: trinketId });
  reasons.push(...measuredReasons(m));

  const measurable = Math.abs(m.dps) >= 0.5 || Math.abs(m.hp) >= 0.5;
  const conditional = !measurable && isConditional(t.desc);
  const gives = TRINKET_GIVES.get(trinketId) ?? [];
  reasons.push(...fitReasons(comp, e, gives, conditional));

  const special = SPECIAL[t.name]?.(comp, i);
  if (special) reasons.push(special);
  else if (!measurable) {
    // Effects we can't model still scale with how many Wielders there are.
    const share = e.count / comp.roster.reduce((s, x) => s + x.count, 0);
    reasons.push({
      delta: Math.min(1, share * 2),
      text: conditional
        ? `Its effect depends on battle (triggers, chances or timers), so it isn’t measured. ${group(e)} would wield it. Read the text.`
        : `Always active, but its effect isn’t counted in these numbers. ${group(e)} would wield it. Read the text.`,
    });
  }

  const score = reasons.reduce((s, x) => s + x.delta, 0);
  return { key: e.key, dude: e.dude, score, grade: toGrade(score), reasons: reasons.toSorted((a, b) => b.delta - a.delta) };
}

/** Grade one offered Trinket on every Dude Type of the Roster, best holder first. */
export function gradeTrinket(trinketId: string, comp: Comp): HoldGrade {
  const holders = comp.roster.map((_, i) => gradeHolder(comp, trinketId, i)).toSorted((a, b) => b.score - a.score);
  return { item: trinketId, holders };
}

