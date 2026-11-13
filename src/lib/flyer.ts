import { cellOf, COLUMNS, columnById, dudeCells, givesToTeam, scales, selfScaling } from '../data/chart';
import { dudeById, familyById, relicById } from '../data/game';

/** How good a flyer option is for the current run. */
export type Grade = '++' | '+' | '0' | '−';

export interface Reason {
  /** Points this reason adds (negative = against). */
  delta: number;
  text: string;
}

export interface OptionGrade {
  dude: string;
  score: number;
  grade: Grade;
  reasons: Reason[];
}

export interface FlyerContext {
  /** Dude Types already unlocked, including 'basic' (Regular Dude). */
  pool: string[];
  /** Run stage: how many Dude Types besides Regular the team already has (0 = first pick, direction still open). */
  flyerIndex: number;
  /** Chart columns the comp is built around. */
  focus: string[];
  /** Planned Relic ids. */
  relics: string[];
}

/** What a flyer favours, by how many types the team already has: early picks set direction, later ones fill gaps. */
export const FLYER_STAGES = [
  { title: 'Set the direction', hint: 'Favours a strong anchor (many blue cells) or a Dude that buffs your Regular Dudes.' },
  { title: 'Commit', hint: 'Favours Dudes that feed your first pick’s stats, and a first healer.' },
  { title: 'Fix the gaps', hint: 'Favours a healer or taunter if you lack one, and stats nobody gives yet.' },
  { title: 'Top up', hint: 'Favours more givers for your stats and Family bonuses.' },
  { title: 'Top up', hint: 'Favours more givers for your stats and Family bonuses.' },
];

const name = (d: string) => dudeById.get(d)?.name ?? d;
const label = (col: string) => columnById.get(col)!.label;
const list = (items: string[]) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const toGrade = (score: number): Grade => {
  if (score >= 4) return '++';
  if (score >= 1.5) return '+';
  if (score > -0.5) return '0';
  return '−';
};

/** Strong anchors scale with many stats; their own Relics push them further. */
function anchorReasons(dude: string, ctx: FlyerContext, poolHasAnchor: boolean): Reason[] {
  const n = selfScaling(dude);
  const out: Reason[] = [];
  const focusScaled = ctx.focus.filter((c) => scales(cellOf(dude, c)));
  if (focusScaled.length) {
    out.push({ delta: Math.min(2, focusScaled.length), text: `Scales with your focus: ${list(focusScaled.map(label))}.` });
  }
  const early = ctx.flyerIndex <= 1 && !(ctx.flyerIndex === 1 && poolHasAnchor);
  if (early && n >= 6) out.push({ delta: 2, text: `Strong anchor: scales with ${n} stats.` });
  else if (early && n >= 4) out.push({ delta: 1, text: `Decent anchor: scales with ${n} stats.` });
  return out;
}

/** Columns this Dude gives to the team that someone in the pool scales with, or that are focus stats. */
function feedReasons(dude: string, ctx: FlyerContext, others: string[]): Reason[] {
  const cells = dudeCells(dude);
  if (!cells) return [];
  let points = 0;
  const parts: string[] = [];
  for (const col of COLUMNS) {
    const cell = cells.get(col.id);
    if (!givesToTeam(cell)) continue;
    const users = others.filter((o) => scales(cellOf(o, col.id)));
    const inFocus = ctx.focus.includes(col.id);
    if (!users.length && !inFocus) continue;
    points += cell === 'Y' ? 1.5 : 1;
    const who = users.length ? ` to ${list(users.map(name))}` : ' (focus stat)';
    parts.push(`${col.label}${who}`);
  }
  if (!parts.length) return [];
  return [{ delta: Math.min(4, points), text: `Gives ${parts.join('; ')}.` }];
}

/** Healers and taunters: fill a missing role (+), don't double up on healers (−). */
function roleReasons(dude: string, ctx: FlyerContext, others: string[]): Reason[] {
  const out: Reason[] = [];
  if (givesToTeam(cellOf(dude, 'heal'))) {
    const healers = others.filter((o) => givesToTeam(cellOf(o, 'heal')));
    if (healers.length) {
      out.push({ delta: -1.5, text: `You already have a healer (${list(healers.map(name))}).` });
    } else {
      out.push({ delta: ctx.flyerIndex === 0 ? 1 : 2, text: 'First healer: nobody unlocked heals other Dudes yet.' });
    }
  }
  const taunts = (d: string) => {
    const c = cellOf(d, 'taunt');
    return !!c && c !== 'R';
  };
  if (taunts(dude) && ctx.flyerIndex >= 1 && !others.some(taunts)) {
    out.push({ delta: 1, text: 'First taunter: draws enemies off your weaker Dudes.' });
  }
  return out;
}

function extraReasons(dude: string, ctx: FlyerContext, others: string[]): Reason[] {
  const out: Reason[] = [];
  const d = dudeById.get(dude);
  // Family: Bonfire and Family Relics reward several types of one Family.
  const sameFamily = others.filter((o) => d?.family && dudeById.get(o)?.family === d.family);
  if (d?.family && sameFamily.length >= 1) {
    out.push({
      delta: sameFamily.length >= 2 ? 1 : 0.5,
      text: `Joins ${list(sameFamily.map(name))} in the ${familyById.get(d.family)!.name} Family (Bonfire, Family Relics).`,
    });
  }
  // Early on the team is mostly Regular Dudes: buffs for other types help them.
  const cells = dudeCells(dude);
  const othersBuffs = cells ? [...cells.values()].filter((c) => c === 'Y').length : 0;
  if (ctx.flyerIndex <= 1 && othersBuffs >= 2) {
    out.push({ delta: 1, text: `Buffs other Dude Types in ${othersBuffs} stats, which helps your Regular Dudes early.` });
  }
  const debuffs = cells ? [...cells.entries()].filter(([, c]) => c === 'R').map(([col]) => label(col)) : [];
  if (debuffs.length >= 2) out.push({ delta: 0.5, text: `Weakens enemies: ${list(debuffs)}.` });
  // Relics you already plan for this Dude.
  const planned = ctx.relics.filter((r) => relicById.get(r)?.dudes?.includes(dude));
  if (planned.length) {
    out.push({ delta: 1, text: `Uses ${planned.length} Relic${planned.length > 1 ? 's' : ''} you planned (${list(planned.map((r) => relicById.get(r)!.name))}).` });
  }
  // Roster position needs (information only).
  if (dude === 'alien') out.push({ delta: 0, text: 'Place another Dude Type above him: Tractor Beam needs one.' });
  if (dude === 'general') out.push({ delta: 0, text: 'Place another Dude Type below him: Tactical Command needs one.' });
  return out;
}

export function gradeOption(dude: string, ctx: FlyerContext): OptionGrade {
  const others = ctx.pool.filter((p) => p !== dude);
  const poolHasAnchor = others.some((o) => selfScaling(o) >= 5);
  const reasons = [
    ...anchorReasons(dude, ctx, poolHasAnchor),
    ...feedReasons(dude, ctx, others),
    ...roleReasons(dude, ctx, others),
    ...extraReasons(dude, ctx, others),
  ];
  const score = reasons.reduce((s, r) => s + r.delta, 0);
  if (!reasons.some((r) => r.delta > 0)) {
    reasons.push({ delta: 0, text: 'Adds little to what you have unlocked.' });
  }
  return { dude, score, grade: toGrade(score), reasons: reasons.toSorted((a, b) => b.delta - a.delta) };
}

/** Stats the unlocked pool scales with most, as a starting point for focus stats. */
export function suggestFocus(pool: string[], limit = 3): string[] {
  return COLUMNS.filter((c) => c.group !== 'enemy')
    .map((c) => ({ id: c.id, n: pool.filter((p) => scales(cellOf(p, c.id))).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((x) => x.id);
}
