import { cellOf, columnById, givesToTeam, scales, selfScaling } from '../data/chart';
import { dudeById, familyById, relicById, type Relic } from '../data/game';
import type { Comp } from './comp';

/**
 * Recruit ratio: how a run's non-Regular Dudes should be split between types.
 * Regular Dudes are left out: the game hands them out at random events, and the
 * training event turns them into other types.
 */

export interface TypeTarget {
  dude: string;
  weight: number;
  /** Target share of the non-Regular Dudes (0–1). */
  share: number;
  /** Target share as a whole percentage; all types add up to exactly 100. */
  sharePct: number;
  /** Target count at the projected total, raised to any minimum. */
  target: number;
  /** Hard minimum from Relics or abilities, if any. */
  min: number | null;
  minSource: string | null;
  count: number;
  /** Current share of the non-Regular Dudes (0–1). */
  current: number;
  reasons: string[];
  /** The user set this target by hand. */
  custom: boolean;
  /** What the automatic split would give, in percent. */
  autoPct: number;
}

export interface RatioPlan {
  types: TypeTarget[];
  total: number;
  projected: number;
  regulars: number;
  /** Problems with the plan: minimums the ratio doesn't cover, caps it exceeds. */
  warnings: string[];
}

/** Abilities that get stronger with more copies of the same type. */
const COPY_SCALERS: Record<string, string> = {
  cyborg: 'Extermination stacks are shared by all Cyborgs',
  soccer: 'Soccer Dudes pass the ball to each other',
  necromancer: 'Each Necrodude brings a Skeledude',
  quantum: 'Each Quantum Dude brings an Echo Dude',
  finance: 'Each Finance Dude makes $3 a battle',
  broadcaster: 'Plays are called by every Broadcaster',
  hacker: 'Every Hacker builds Exploits',
};

/** Ability minimums that hold whatever Relics you plan. */
const ABILITY_MINIMUMS: Record<string, { min: number; source: string }> = {
  soccer: { min: 2, source: 'Total Football (needs someone to pass to)' },
};

const BONFIRE_CAP = 20;

const plural = (d: string) => `${dudeById.get(d)?.name ?? d}s`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Names a Relic uses for a Dude Type: "Football Dude" or "Football Dudes". */
function matchesDude(text: string, dude: string) {
  const name = dudeById.get(dude)?.name;
  return !!name && (text === name || text === `${name}s`);
}

/** Planned Relics that scale "per / for every / for each [X Dude]". */
function perCopyRelics(dude: string, planned: Relic[]) {
  return planned.filter((r) =>
    r.desc.some(
      ([k, t], i) => k === 'v' && matchesDude(t, dude) && i > 0 && /(per|for every|for each)\s*$/i.test(r.desc[i - 1][1]),
    ),
  );
}

/** "at least [12] [Football Dudes]" in a planned Relic. */
function relicMinimum(dude: string, planned: Relic[]): { min: number; source: string } | null {
  let best: { min: number; source: string } | null = null;
  for (const r of planned) {
    r.desc.forEach(([k, t], i) => {
      const next = r.desc[i + 1];
      const prev = r.desc[i - 1];
      if (k !== 'v' || !next || !prev) return;
      if (!/at least\s*$/i.test(prev[1]) || !matchesDude(next[1], dude)) return;
      const n = Number.parseInt(t, 10);
      if (Number.isFinite(n) && (!best || n > best.min)) best = { min: n, source: r.name };
    });
  }
  return best;
}

function weigh(dude: string, focus: string[], planned: Relic[]) {
  let weight = 1;
  const reasons: string[] = [];
  const focusScaled = focus.filter((c) => scales(cellOf(dude, c)));
  if (focusScaled.length) {
    weight += Math.min(3, focusScaled.length);
    reasons.push(`Scales with your focus: ${focusScaled.map((c) => columnById.get(c)!.label).join(', ')}`);
  } else if (!focus.length && selfScaling(dude) >= 5) {
    weight += 1;
    reasons.push(`Self-scaling anchor (${selfScaling(dude)} blue cells)`);
  }
  if (COPY_SCALERS[dude]) {
    weight += 0.5;
    reasons.push(COPY_SCALERS[dude]);
  }
  const perCopy = perCopyRelics(dude, planned);
  if (perCopy.length) {
    weight += perCopy.length;
    reasons.push(`Relics that grow per ${dudeById.get(dude)?.name}: ${perCopy.map((r) => r.name).join(', ')}`);
  }
  if (reasons.length === 0) {
    const support = ['heal', 'taunt'].filter((c) => givesToTeam(cellOf(dude, c)) || cellOf(dude, c) === 'B');
    reasons.push(support.length ? 'Support: a steady smaller share is enough' : 'Utility: a steady smaller share is enough');
  }
  return { weight, reasons };
}

/**
 * Split `total` into whole numbers proportional to `shares` that add up to exactly `total`
 * (largest remainder method). Ties go to the bigger share, then to the earlier item.
 */
export function apportion(shares: number[], total: number): number[] {
  const exact = shares.map((s) => s * total);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x), share: shares[i] }))
    .toSorted((a, b) => b.rem - a.rem || b.share - a.share || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    counts[i] += 1;
    left -= 1;
  }
  return counts;
}

/**
 * Target shares (0–1) for each weighed type. Types with a target set by hand keep it; the rest
 * split what's left by their automatic weights. If hand-set targets can't fit in 100%, everything
 * is scaled to fit and a warning says so.
 */
function resolveShares(
  weighed: { dude: string; weight: number }[],
  custom: Record<string, number>,
  warnings: string[],
): { shares: number[]; autoPcts: number[] } {
  const weightSum = weighed.reduce((s, w) => s + w.weight, 0) || 1;
  const autoPcts = apportion(
    weighed.map((w) => w.weight / weightSum),
    100,
  );
  const isCustom = weighed.map((w) => custom[w.dude] !== undefined);
  const customSum = weighed.reduce((s, w, i) => s + (isCustom[i] ? custom[w.dude] : 0), 0);
  const freeWeight = weighed.reduce((s, w, i) => s + (isCustom[i] ? 0 : w.weight), 0);
  const rest = Math.max(0, 100 - customSum);

  let shares = weighed.map((w, i) => {
    if (isCustom[i]) return custom[w.dude] / 100;
    return freeWeight ? (rest / 100) * (w.weight / freeWeight) : 0;
  });

  const anyCustom = isCustom.some(Boolean);
  const allCustom = isCustom.every(Boolean);
  if (anyCustom && customSum > 100) {
    warnings.push(`Your targets add up to ${customSum}%, so they’re scaled down to fit 100% and the other types get none.`);
  } else if (anyCustom && allCustom && customSum !== 100) {
    warnings.push(`Your targets add up to ${customSum}%, so they’re scaled to fit 100%.`);
  }
  const total = shares.reduce((s, x) => s + x, 0);
  if (total > 0 && Math.abs(total - 1) > 1e-9) shares = shares.map((x) => x / total);
  return { shares, autoPcts };
}

/** Highest-scoring item, or undefined for an empty list. */
function maxBy<T>(items: T[], score: (t: T) => number): T | undefined {
  let best: T | undefined;
  for (const item of items) if (best === undefined || score(item) > score(best)) best = item;
  return best;
}

/** Bonfire tops out at 20 Dudes per Family: say where targets go past that. */
function bonfireWarnings(types: TypeTarget[]): string[] {
  const byFamily = new Map<string, number>();
  for (const t of types) {
    const fam = dudeById.get(t.dude)?.family;
    if (fam) byFamily.set(fam, (byFamily.get(fam) ?? 0) + t.target);
  }
  return [...byFamily]
    .filter(([, n]) => n > BONFIRE_CAP)
    .map(([fam, n]) => {
      const name = familyById.get(fam)?.name ?? fam;
      return `Bonfire tops out at ${BONFIRE_CAP} Dudes per Family. Your targets put ${n} in ${name}, so ${n - BONFIRE_CAP} of them add no extra Bonfire HP. Fine if ${name} is your core; otherwise spread across Families.`;
    });
}

export function ratioPlan(comp: Comp): RatioPlan {
  const planned = comp.relics.map((id) => relicById.get(id)).filter((r): r is Relic => !!r);
  let regulars = 0;
  const counts = new Map<string, number>();
  for (const e of comp.roster) {
    if (e.dude === 'basic') regulars += e.count;
    else counts.set(e.dude, (counts.get(e.dude) ?? 0) + e.count);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  const projected = Math.max(comp.projected, total);

  const weighed = [...counts.keys()].map((dude) => ({ dude, ...weigh(dude, comp.focus, planned) }));
  // Championship Belt rewards one clearly biggest type: push the top-weighted one further.
  const top = planned.some((r) => r.name === 'Championship Belt') ? maxBy(weighed, (w) => w.weight) : undefined;
  if (top) {
    top.weight += 1;
    top.reasons.push('Championship Belt: make this your largest type');
  }
  const warnings: string[] = [];
  const { shares, autoPcts } = resolveShares(weighed, comp.targets, warnings);
  const counted = apportion(shares, projected);

  const pcts = apportion(
    counted.map((n) => n / projected),
    100,
  );

  const types: TypeTarget[] = weighed.map((w, i) => {
    const custom = comp.targets[w.dude] !== undefined;
    // Share is shown from the whole-number target, so percentages and counts always agree and add up.
    const ratioCount = counted[i];
    const share = ratioCount / projected;
    const minInfo = relicMinimum(w.dude, planned) ?? ABILITY_MINIMUMS[w.dude] ?? null;
    if (minInfo && minInfo.min > ratioCount) {
      warnings.push(
        `${minInfo.source} needs ${minInfo.min} ${plural(w.dude)} (${pct(minInfo.min / projected)} of ${projected}), but the ratio gives ${ratioCount} (${pct(share)}). Recruit ${plural(w.dude)} beyond the ratio, or drop ${minInfo.source}.`,
      );
    }
    const count = counts.get(w.dude) ?? 0;
    return {
      dude: w.dude,
      weight: w.weight,
      share,
      sharePct: pcts[i],
      target: Math.max(ratioCount, minInfo?.min ?? 0),
      min: minInfo?.min ?? null,
      minSource: minInfo?.source ?? null,
      count,
      current: total ? count / total : 0,
      reasons: custom ? [`Set by you (automatic would be ${autoPcts[i]}%)`, ...w.reasons] : w.reasons,
      custom,
      autoPct: autoPcts[i],
    };
  });
  if (planned.some((r) => r.name === 'Bonfire')) warnings.push(...bonfireWarnings(types));

  return { types: types.toSorted((a, b) => b.share - a.share), total, projected, regulars, warnings };
}

export interface Advice {
  pick: string;
  reasons: Map<string, string>;
}

/**
 * Which of the offered types to take. Priority: a minimum that's 1–2 away,
 * then whichever type is furthest below its target share.
 */
export function adviseRecruit(plan: RatioPlan, offer: string[]): Advice | null {
  const options = offer.map((d) => plan.types.find((t) => t.dude === d)).filter((t): t is TypeTarget => !!t);
  if (!options.length) return null;
  const reasons = new Map<string, string>();
  const nearMin = options.filter((t) => t.min !== null && t.count < t.min && t.min - t.count <= 2);
  for (const t of options) {
    if (t.min !== null && t.count < t.min && t.min - t.count <= 2) {
      reasons.set(t.dude, `${t.min - t.count} away from ${t.min} for ${t.minSource}.`);
    } else {
      const gap = t.share - t.current;
      reasons.set(
        t.dude,
        gap > 0.005
          ? `Below target: ${pct(t.current)} now, aiming for ${t.sharePct}%.`
          : `At or above target: ${pct(t.current)} now, aiming for ${t.sharePct}%.`,
      );
    }
  }
  const pool = nearMin.length ? nearMin : options;
  const pick = maxBy(pool, (t) => t.share - t.current)!;
  return { pick: pick.dude, reasons };
}

/** How many Regulars to train into this type: enough to reach its share once every Regular is trained. */
export function suggestTraining(plan: RatioPlan, dude: string) {
  const t = plan.types.find((x) => x.dude === dude);
  if (!t || plan.regulars === 0) return 0;
  const after = plan.total + plan.regulars;
  const wanted = Math.round(t.share * after) - t.count;
  const toMin = t.min !== null ? t.min - t.count : 0;
  return Math.max(1, Math.min(plan.regulars, Math.max(wanted, toMin)));
}
