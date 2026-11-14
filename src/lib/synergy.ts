import { dudeById, families, relicById, relics, statNum, type Dude, type Relic } from '../data/game';
import {
  CHART_DUDES,
  cellOf,
  columnById,
  familyCells,
  focusScore,
  givesToTeam,
  gradeInfo,
  gradeOf,
  gradeWeight,
  healRelics,
  healStrength,
  RELIC_GIVES,
  scales,
  selfScaling,
  type Cell,
} from '../data/chart';
import { MAX_TYPES, type Comp, type Entry } from './comp';

const relicIdByName = new Map(relics.map((r) => [r.name, r.id]));
const rid = (name: string) => relicIdByName.get(name) ?? name;

export type Dir = 'above' | 'below' | 'adjacent';

/** An effect that reaches from one roster entry to a neighbour. */
export interface Link {
  from: number;
  to: number;
  label: string;
  source: string;
  kind: 'ability' | 'relic';
}

export interface Note {
  tone: 'good' | 'warn' | 'info';
  text: string;
}

export interface TeamSynergy {
  id: string;
  title: string;
  detail: string;
  planned: boolean;
  icon?: string;
}

export type Role = 'taunt' | 'heal' | 'money' | 'summon' | 'aoe';
export const ROLE_LABELS: Record<Role, string> = {
  taunt: 'Taunts',
  heal: 'Heals',
  aoe: 'Area damage',
  summon: 'Summons',
  money: 'Makes money',
};

/** One focus stat: who on the Roster scales with it, and who gives it to the team. */
export interface FocusLine {
  col: string;
  /** Roster Dudes with B/D: they scale with it. */
  scalers: { dude: string; cell: Cell }[];
  /** Roster Dudes with G/Y: they give it to other Dude Types. */
  givers: { dude: string; cell: Cell }[];
  /** Families on the Roster whose Family Relics give it. */
  families: string[];
  /** Planned Relics that give it. */
  relics: string[];
  /** Dudes not on the Roster that scale with it, most self-scaling first. */
  anchors: string[];
  /** Dudes not on the Roster that give it to others, strongest first (Y over G, then grade). */
  suggestions: string[];
}

export interface HealerCheck {
  /** Roster Dudes that heal other Dude Types now: by ability, or with one of their healing Relics in Your Relics. */
  healers: string[];
  /** Roster Dudes that would heal the team with one of their Relics you don't have yet. */
  couldHeal: { dude: string; relics: string[] }[];
  /** Healers to add if there are none. */
  suggestions: string[];
}

/** A Dude to fill an open Roster slot, ranked over all focus stats together. */
export interface TeamPick {
  dude: string;
  score: number;
  reasons: string[];
}

export interface Analysis {
  focusLines: FocusLine[];
  healer: HealerCheck;
  /** Best Dudes for the open Roster slots (empty without focus stats or open slots). */
  fill: TeamPick[];
  /** Dude Types you can still add (MAX_TYPES minus non-Regular types on the Roster). */
  openSlots: number;
  links: Link[];
  notes: Map<string, Note[]>;
  familyCounts: { id: string; dudes: number; types: number }[];
  teamSynergies: TeamSynergy[];
  roles: Record<Role, string[]>;
  totalDudes: number;
  totalHp: number;
  totalDps: number;
  relevantRelics: Set<string>;
}

interface PositionalRule {
  dude: string;
  relic?: string;
  dir: Dir;
  label: string;
  source: string;
}

const POSITIONAL: PositionalRule[] = [
  { dude: 'alien', dir: 'above', label: 'Tractor Beams', source: 'Tractor Beam' },
  { dude: 'general', dir: 'below', label: 'Commands to Taunt', source: 'Tactical Command' },
  { dude: 'time', dir: 'adjacent', label: 'Attaches Time Anomalies', source: 'Time Anomaly' },
  { dude: 'alien', relic: rid('Brain Implant'), dir: 'above', label: 'Equalizes HP with', source: 'Brain Implant' },
  { dude: 'alien', relic: rid('Dissection Kit'), dir: 'below', label: 'May save from Fatal Damage', source: 'Dissection Kit' },
  { dude: 'manager', relic: rid('Employee Award'), dir: 'below', label: '+20% Max HP, +10% Deflection', source: 'Employee Award' },
  { dude: 'finance', relic: rid('Life Insurance'), dir: 'below', label: 'Insures (+$2 on KO)', source: 'Life Insurance' },
  { dude: 'football', relic: rid('Warm Bench'), dir: 'adjacent', label: '+10% Attack Power, +5% Toughness', source: 'Warm Bench' },
];

/** Dudes whose positional ability fizzles without a neighbour. */
const NEEDS_NEIGHBOUR: Record<string, Dir> = { alien: 'above', general: 'below', time: 'adjacent' };

const ROLE_TERMS: [Role, RegExp][] = [
  ['taunt', /^Taunt/],
  ['heal', /^(Heal|Donate)/],
  ['summon', /^Summon/],
];

function rolesOf(d: Dude): Role[] {
  const out = new Set<Role>();
  for (const [kind, text] of d.ability.desc) {
    if (kind === 'g') for (const [role, re] of ROLE_TERMS) if (re.test(text)) out.add(role);
    if (kind === 'v' && text.startsWith('$')) out.add('money');
  }
  if (/enemies nearby|caught in the blast|blast area/.test(d.ability.desc.map((t) => t[1]).join(''))) out.add('aoe');
  return [...out];
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
const fam = (id: string | null) => families.find((f) => f.id === id)?.name ?? 'No Family';

type NoteFn = (e: Entry, n: Note) => void;
const dudeOf = (e: Entry) => dudeById.get(e.dude)!;

/** Roster offsets each direction reaches. */
const DIR_OFFSETS: Record<Dir, number[]> = { above: [-1], below: [1], adjacent: [-1, 1] };

/** Does the Roster slot i have the neighbour this direction needs? */
function hasNeighbour(need: Dir, i: number, length: number) {
  if (need === 'above') return i > 0;
  if (need === 'below') return i < length - 1;
  return length > 1;
}

/** Links from the Dude Type at slot i, for every positional rule he has (abilities, planned Relics). */
function linksFrom(e: Entry, i: number, length: number, planned: Set<string>): Link[] {
  const out: Link[] = [];
  for (const rule of POSITIONAL) {
    if (rule.dude !== e.dude || (rule.relic && !planned.has(rule.relic))) continue;
    const kind = rule.relic ? 'relic' : 'ability';
    for (const t of DIR_OFFSETS[rule.dir].map((o) => i + o)) {
      if (t >= 0 && t < length) out.push({ from: i, to: t, label: rule.label, source: rule.source, kind });
    }
  }
  return out;
}

function positionLinks(roster: Entry[], planned: Set<string>, note: NoteFn): Link[] {
  const links: Link[] = [];
  roster.forEach((e, i) => {
    links.push(...linksFrom(e, i, roster.length, planned));
    const need = NEEDS_NEIGHBOUR[e.dude];
    if (need && !hasNeighbour(need, i, roster.length)) {
      const where = need === 'adjacent' ? 'next to him' : need;
      note(e, { tone: 'warn', text: `${dudeOf(e).ability.name} needs a Dude Type ${where}.` });
    }
  });
  return links;
}

/** Relics that buff one Roster slot: top, end, third. */
function slotRelicNotes(roster: Entry[], planned: Set<string>, note: NoteFn) {
  const top = roster.at(0);
  const end = roster.at(-1);
  if (!top || !end) return;
  if (planned.has(rid("Captain's Hat"))) note(top, { tone: 'good', text: "Captain's Hat: +30% Attack Power (top of Roster)." });
  if (planned.has(rid('Caboose'))) note(end, { tone: 'good', text: 'Caboose: +30% Max HP (end of Roster).' });
  if (planned.has(rid('Black Sheep'))) note(end, { tone: 'good', text: 'Black Sheep: Taunts up to 5 enemies at battle start.' });
  if (planned.has(rid("Lieutenant's Sigil")) && roster[2]) {
    note(roster[2], { tone: 'good', text: "Lieutenant's Sigil: +10% Crit Chance (third on Roster)." });
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

interface CountCtx {
  /** Copies of this Dude Type on the Roster. */
  n: number;
  totalDudes: number;
  planned: Set<string>;
}

function warmBenchNote(n: number): Note {
  return n >= 12
    ? { tone: 'good', text: `Warm Bench doubled (${n} Football Dudes).` }
    : { tone: 'info', text: `Warm Bench doubles at 12 Football Dudes (${n} now).` };
}

/** Notes for abilities that scale with (or need) a number of Dudes. */
const COUNT_NOTES: Record<string, (c: CountCtx) => Note[]> = {
  basic: ({ n }) => [
    n > 1
      ? { tone: 'good', text: `Mob Mentality: +${pct(2 * (n - 1))} Attack Power and Max HP each (${n} Regular Dudes).` }
      : { tone: 'info', text: 'Mob Mentality grows with every extra Regular Dude.' },
  ],
  cyborg: ({ n }) => [{ tone: n > 1 ? 'good' : 'info', text: `Extermination stacks are shared by all ${plural(n, 'Cyborg Dude')}.` }],
  finance: ({ n }) => [{ tone: 'good', text: `Dividend: $${3 * n} after each battle.` }],
  necromancer: ({ n }) => [{ tone: 'info', text: `Brings ${plural(n, 'Skeledude')} into battle.` }],
  quantum: ({ n }) => [{ tone: 'info', text: `Brings up to ${plural(n, 'Echo Dude')} into battle.` }],
  soccer: ({ n }) => (n < 2 ? [{ tone: 'warn', text: 'Total Football passes between Soccer Dudes. Add more than one.' }] : []),
  manager: ({ n, totalDudes }) =>
    totalDudes - n < 4 ? [{ tone: 'warn', text: `Micromanage picks 4 non-Manager Interns; you have ${totalDudes - n}.` }] : [],
  football: ({ n, totalDudes, planned }) => {
    const out: Note[] = [];
    if (totalDudes - n < 2) out.push({ tone: 'warn', text: 'Blitz teams up with 2 non-Football Dudes; add more.' });
    if (planned.has(rid('Warm Bench'))) out.push(warmBenchNote(n));
    return out;
  },
};

function countNotes(roster: Entry[], planned: Set<string>, totalDudes: number, note: NoteFn) {
  const countOf = (id: string) => roster.filter((e) => e.dude === id).reduce((s, e) => s + e.count, 0);
  for (const e of roster) {
    const rule = COUNT_NOTES[e.dude];
    if (rule) for (const n of rule({ n: countOf(e.dude), totalDudes, planned })) note(e, n);
  }
}

function familyCountsOf(roster: Entry[]) {
  return families
    .map((f) => {
      const es = roster.filter((e) => dudeOf(e).family === f.id);
      return { id: f.id, dudes: es.reduce((s, e) => s + e.count, 0), types: new Set(es.map((e) => e.dude)).size };
    })
    .sort((a, b) => b.dudes - a.dudes);
}

/** Team-wide relic payoffs, shown whether planned or not so you can see what they'd give. */
function teamSynergiesOf(roster: Entry[], planned: Set<string>, presentFamilies: { id: string; dudes: number }[]): TeamSynergy[] {
  if (!roster.length) return [];
  const out: TeamSynergy[] = [];
  const syn = (name: string, detail: string) => {
    const r = relicById.get(rid(name));
    out.push({ id: rid(name), title: name, detail, planned: planned.has(rid(name)), icon: r?.icon });
  };
  syn('Bonfire', presentFamilies.map((f) => `${fam(f.id)} +${Math.min(20, f.dudes)}%`).join(', ') + ' Max HP');
  const byType = new Map<string, number>();
  for (const e of roster) byType.set(e.dude, (byType.get(e.dude) ?? 0) + e.count);
  const [topType, topN] = [...byType].sort((a, b) => b[1] - a[1])[0];
  syn('Championship Belt', `${dudeById.get(topType)!.name} (${topN}) gains +30% Attack Power`);
  syn('Sensitivity Training', `All Dudes +${presentFamilies.length * 4}% Attack Power (${presentFamilies.length} Families)`);
  return out;
}

export function analyse(comp: Comp): Analysis {
  const roster = comp.roster;
  const planned = new Set(comp.relics);
  const notes = new Map<string, Note[]>();
  const note: NoteFn = (e, n) => notes.set(e.key, [...(notes.get(e.key) ?? []), n]);
  const totalDudes = roster.reduce((s, e) => s + e.count, 0);

  const links = positionLinks(roster, planned, note);
  slotRelicNotes(roster, planned, note);
  countNotes(roster, planned, totalDudes, note);

  const familyCounts = familyCountsOf(roster);
  const presentFamilies = familyCounts.filter((f) => f.dudes > 0);
  const teamSynergies = teamSynergiesOf(roster, planned, presentFamilies);

  const types = roster.map((e) => e.dude);
  const healer = healerCheck(types, comp.focus, comp.relics);
  const roles: Record<Role, string[]> = { taunt: [], heal: [], aoe: [], summon: [], money: [] };
  for (const e of roster) for (const r of rolesOf(dudeOf(e))) if (r !== 'heal') roles[r].push(e.dude);
  roles.heal = types.filter((d) => healer.healers.includes(d));

  const totalHp = roster.reduce((s, e) => s + statNum(dudeOf(e), 'hpmax') * e.count, 0);
  const totalDps = roster.reduce((s, e) => s + statNum(dudeOf(e), 'dps') * e.count, 0);

  const typeSet = new Set(roster.map((e) => e.dude));
  const famSet = new Set(presentFamilies.map((f) => f.id));
  const relevantRelics = new Set(relics.filter((r) => relicRelevant(r, typeSet, famSet)).map((r) => r.id));

  const focusLines = focusLineup(types, comp.focus, comp.relics);
  const fill = fillTeam(types, comp.focus, healer.healers.length > 0);
  const openSlots = Math.max(0, MAX_TYPES - new Set(types.filter((d) => d !== 'basic')).size);

  return { focusLines, healer, fill, openSlots, links, notes, familyCounts, teamSynergies, roles, totalDudes, totalHp, totalDps, relevantRelics };
}

/** Stronger givers first: Y (3) or G (2), times the estimated grade. */
const byCellStrength = (col: string) => (a: string, b: string) => focusScore(b, [col]) - focusScore(a, [col]);

/** For each focus stat: who scales with it, and who (Dudes, Families, planned Relics) gives it. */
export function focusLineup(types: string[], focus: string[], plannedRelics: string[]): FocusLine[] {
  const unique = [...new Set(types)];
  const fams = [...new Set(unique.map((d) => dudeById.get(d)?.family).filter((f): f is string => !!f))];
  return focus.map((col) => {
    const withCell = (pred: (c: Cell | undefined) => boolean) =>
      unique.filter((d) => pred(cellOf(d, col))).map((d) => ({ dude: d, cell: cellOf(d, col)! }));
    return {
      col,
      scalers: withCell(scales),
      givers: withCell(givesToTeam),
      families: fams.filter((f) => givesToTeam(familyCells(f)?.get(col))),
      relics: plannedRelics.filter((id) => (RELIC_GIVES.get(id) ?? []).includes(col)),
      anchors: CHART_DUDES.filter((d) => !unique.includes(d) && scales(cellOf(d, col))).sort((x, y) => selfScaling(y) - selfScaling(x)),
      suggestions: CHART_DUDES.filter((d) => !unique.includes(d) && givesToTeam(cellOf(d, col))).sort(byCellStrength(col)),
    };
  });
}

/** How much a Dude gives the focus stats to the team (Y 3, G 2, times grade). */
const giveFit = (dude: string, focus: string[]) =>
  focus.reduce((sum, col) => sum + (givesToTeam(cellOf(dude, col)) ? focusScore(dude, [col]) : 0), 0);

/** Healing weight: up to 4 for the best healer by estimated HP/s (colour doesn't matter for healing). */
const HEAL_SCORE = 4;

/** His ability heals other Dudes: the chart marks him a team healer and his ability text heals. */
function abilityHealsTeam(dude: string) {
  const d = dudeById.get(dude);
  return !!d && givesToTeam(cellOf(dude, 'heal')) && rolesOf(d).includes('heal');
}

/** Heals teammates now: by his ability, or with one of his healing Relics among the comp's Relics. */
export function healsTeam(dude: string, relicIds: string[]) {
  if (abilityHealsTeam(dude)) return true;
  const owned = new Set(relicIds.map((id) => relicById.get(id)?.name));
  return healRelics(dude).some((n) => owned.has(n));
}

/** Step 3 of the method: make sure someone heals the other Dude Types. Ranked by estimated HP/s, plus focus-stat giving. */
export function healerCheck(types: string[], focus: string[] = [], relicIds: string[] = []): HealerCheck {
  const unique = [...new Set(types)];
  const healers = unique.filter((d) => healsTeam(d, relicIds));
  const couldHeal = unique
    .filter((d) => !healers.includes(d) && healRelics(d).length > 0)
    .map((d) => ({ dude: d, relics: healRelics(d) }));
  const strength = (d: string) => HEAL_SCORE * healStrength(d) + giveFit(d, focus);
  const suggestions = healers.length
    ? []
    : CHART_DUDES.filter((d) => givesToTeam(cellOf(d, 'heal'))).sort((a, b) => strength(b) - strength(a));
  return { healers, couldHeal, suggestions };
}

/** "Atk Pow (Y, S)": the column with the cell's colour (yellow only) and grade. */
function cellTag(dude: string, col: string) {
  const extra = [cellOf(dude, col) === 'Y' ? 'yellow' : '', gradeOf(dude, col) ?? ''].filter(Boolean).join(', ');
  const short = columnById.get(col)!.short;
  return extra ? `${short} (${extra})` : short;
}

interface FillState {
  /** Givers per focus stat so far (Roster + picks): each extra giver of a covered stat counts half. */
  givers: Map<string, number>;
  /** Focus stats someone already scales with. */
  scaled: Set<string>;
  hasHealer: boolean;
}

function pickFor(dude: string, focus: string[], st: FillState): TeamPick {
  let score = 0;
  const gives: string[] = [];
  const scalesWith: string[] = [];
  for (const col of focus) {
    const c = cellOf(dude, col);
    if (givesToTeam(c)) {
      score += focusScore(dude, [col]) * 0.5 ** (st.givers.get(col) ?? 0);
      gives.push(cellTag(dude, col));
    } else if (scales(c) && !st.scaled.has(col)) {
      score += gradeWeight(dude, col);
      scalesWith.push(cellTag(dude, col));
    }
  }
  const reasons: string[] = [];
  if (gives.length) reasons.push(`Gives ${gives.join(', ')}`);
  if (!st.hasHealer && givesToTeam(cellOf(dude, 'heal'))) {
    score += HEAL_SCORE * healStrength(dude);
    const hps = gradeInfo(dude, 'heal');
    const how = abilityHealsTeam(dude) ? '' : ` with ${healRelics(dude).join(' or ')}`;
    reasons.push(hps ? `Heals the team${how} (${hps.grade}, ~${Math.round(hps.value)} HP/s)` : `Heals the team${how}`);
  }
  if (scalesWith.length) reasons.push(`Scales with ${scalesWith.join(', ')}`);
  return { dude, score, reasons };
}

/**
 * Fill the open Roster slots: pick Dudes not on the Roster one at a time, scored across all focus stats together.
 * Giving a focus stat counts most, halved for each Dude already giving it (so picks spread over the stats);
 * scaling with one counts only while no one does yet; healing counts until there's a healer.
 */
export function fillTeam(types: string[], focus: string[], hasHealer: boolean): TeamPick[] {
  const unique = new Set(types);
  const open = MAX_TYPES - [...unique].filter((d) => d !== 'basic').length;
  if (open <= 0 || !focus.length) return [];
  const st: FillState = {
    givers: new Map(focus.map((col) => [col, [...unique].filter((d) => givesToTeam(cellOf(d, col))).length])),
    scaled: new Set(focus.filter((col) => [...unique].some((d) => scales(cellOf(d, col))))),
    hasHealer,
  };
  const pool = CHART_DUDES.filter((d) => !unique.has(d));
  const picks: TeamPick[] = [];
  while (picks.length < Math.min(6, open + 2)) {
    const best = pool
      .filter((d) => !picks.some((p) => p.dude === d))
      .map((d) => pickFor(d, focus, st))
      .reduce<TeamPick | undefined>((top, p) => (p.score > (top?.score ?? 0) ? p : top), undefined);
    if (!best) break;
    picks.push(best);
    for (const col of focus) {
      const c = cellOf(best.dude, col);
      if (givesToTeam(c)) st.givers.set(col, (st.givers.get(col) ?? 0) + 1);
      else if (scales(c)) st.scaled.add(col);
    }
    if (givesToTeam(cellOf(best.dude, 'heal'))) st.hasHealer = true;
  }
  return picks;
}

export function relicRelevant(r: Relic, types: Set<string>, fams: Set<string>) {
  if (r.scope === 'global') return true;
  if (r.scope === 'family') return !!r.family && fams.has(r.family);
  return !!r.dudes?.some((d) => types.has(d));
}
