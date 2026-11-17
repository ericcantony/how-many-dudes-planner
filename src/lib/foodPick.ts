import { cellOf, columnById, scales } from '../data/chart';
import { dudeById, foodById } from '../data/game';
import { FOOD_FIRST, foodStats, foodText, NO_SECOND } from '../data/food';
import type { Comp } from './comp';
import type { Reason } from './flyer';
import { measuredReasons, measureSwap, toGrade, type HolderGrade, type HoldGrade } from './trinketPick';

/**
 * Food stash helper: the game offers meals, and you give one to a Dude Type (every copy eats it).
 * Like the Trinket stash, the main signal is measured: give him the meal, recompute the team, and
 * compare effective damage and survivability. Amounts are in data/food.ts. Stats the measurement
 * can't see (Crit Damage, Healing Received, Run Speed) still count through focus and scaling fit.
 */

type Entry = Comp['roster'][number];

const nameOf = (dude: string) => dudeById.get(dude)?.name ?? dude;
const label = (col: string) => columnById.get(col)?.label ?? col;

/** Focus and scaling fit for the meal's stats (smaller than for Trinkets: the numbers already count). */
function fitReasons(comp: Comp, e: Entry, cols: string[]): Reason[] {
  const out: Reason[] = [];
  const focus = cols.filter((c) => comp.focus.includes(c));
  if (focus.length) out.push({ delta: focus.length, text: `Gives your focus stat${focus.length > 1 ? 's' : ''}: ${focus.map(label).join(' and ')}.` });
  const scaled = cols.filter((c) => !comp.focus.includes(c) && scales(cellOf(e.dude, c)));
  if (scaled.length) out.push({ delta: 0.75, text: `${nameOf(e.dude)} scales with ${scaled.map(label).join(' and ')}.` });
  return out;
}

function gradeHolder(comp: Comp, foodId: string, second: string | null, i: number): HolderGrade {
  const e = comp.roster[i];
  const reasons: Reason[] = [];
  const current = e.food ? foodById.get(e.food) : null;
  const same = e.food === foodId && (e.foodSecond ?? null) === second;
  if (same) reasons.push({ delta: 0, text: `${nameOf(e.dude)} already eats it.` });
  else if (current) reasons.push({ delta: -0.5, text: `Replaces his ${current.name} (counted in the numbers).` });

  // Measure against the Roster without a meal on him when he already eats this one, so it isn't compared with itself.
  const base = same ? { ...comp, roster: comp.roster.map((x) => (x.key === e.key ? { ...x, food: null, foodSecond: null } : x)) } : comp;
  reasons.push(...measuredReasons(measureSwap(base, e.key, { food: foodId, foodSecond: second })));

  const stats = foodStats(foodId, second);
  reasons.push(...fitReasons(comp, e, stats.map((s) => s.col)));
  if (!second && FOOD_FIRST[foodId]) {
    reasons.push({ delta: 0, text: 'Only the first stat is counted. Pick the second stat when you see it.' });
  } else if (second === NO_SECOND) {
    reasons.push({ delta: 0, text: `No second stat, so the first is bigger: ${foodText(stats)}.` });
  }

  const score = reasons.reduce((s, x) => s + x.delta, 0);
  return { key: e.key, dude: e.dude, score, grade: toGrade(score), reasons: reasons.toSorted((a, b) => b.delta - a.delta) };
}

/** Grade one offered meal on every Dude Type of the Roster, best holder first. */
export function gradeFood(foodId: string, second: string | null, comp: Comp): HoldGrade {
  const holders = comp.roster.map((_, i) => gradeHolder(comp, foodId, second, i)).toSorted((a, b) => b.score - a.score);
  return { item: foodId, holders };
}
