import { dudeById, relicById, statNum, trinketById, type Token } from '../data/game';
import type { Comp, Entry } from './comp';

/**
 * Per-Dude stats as the game panel shows them: base Dudex stats plus the buffs we can work out
 * from the Roster, planned Relics and Trinkets. In-battle, random and conditional effects
 * ("When…", "for 3 seconds", "chance") are left out, so values are an estimate.
 */

/** Stats shown on each Roster row, in game-panel order. */
export const SHOWN_STATS = [
  { key: 'hpmax', label: 'Max HP', icon: 'sp_stat_maxhp' },
  { key: 'dps', label: 'DPS', icon: 'sp_stat_dps' },
  { key: 'speed', label: 'Run Speed', icon: 'sp_stat_speed' },
  { key: 'crit_chance', label: 'Crit Chance', icon: 'sp_stat_critchance' },
  { key: 'evasion', label: 'Evasion', icon: 'sp_stat_evasion' },
  { key: 'toughness', label: 'Toughness', icon: 'sp_stat_toughness' },
  { key: 'deflection', label: 'Deflection', icon: 'sp_ui_staticon_deflection' },
  { key: 'block_chance', label: 'Block Chance', icon: 'sp_stat_block_chance' },
  { key: 'cleave', label: 'Cleave', icon: 'sp_stat_cleave' },
  { key: 'regeneration', label: 'Regeneration', icon: 'sp_stat_regeneration' },
  { key: 'lifesteal', label: 'Lifesteal', icon: 'sp_stat_lifesteal' },
] as const;

/** Glossary term in Relic text → stat key. */
const TERM: Record<string, string> = {
  'Max HP': 'hpmax',
  'Attack Power': 'damage',
  'Attack Speed': 'attack_speed',
  'Run Speed': 'speed',
  'Crit Chance': 'crit_chance',
  Evasion: 'evasion',
  Toughness: 'toughness',
  Deflection: 'deflection',
  'Block Chance': 'block_chance',
  Cleave: 'cleave',
  Regeneration: 'regeneration',
  Lifesteal: 'lifesteal',
};

/** Stats where "+20%" multiplies the base; the rest are percentages where "+20%" adds 20 points. */
const MULTIPLICATIVE = new Set(['hpmax', 'damage', 'attack_speed', 'speed']);

/**
 * Diminishing Stats (Dudex glossary): each new source is reduced by the value you already have.
 * 30% Toughness + a 10% source = 30% + 10% × (1 − 30%) = 37%. Order doesn't change the result.
 */
export const DIMINISHING = new Set(['toughness', 'evasion', 'deflection', 'block_chance', 'crit_chance']);

/** Phrases that make a bonus conditional or temporary, so it isn't counted. */
// "now" marks an ability change ("Bear Form now grants…", "Tractor Beam now targets…"): it only
// matters while that ability is in use, so it counts as conditional.
const CONDITIONAL = /\b(when|whenever|if|every|while|after|before|chance|during|once|seconds?|until|first|instead|now)\b/i;

/**
 * Whether a Relic's main effect (its first sentence) only happens sometimes: "When…", "chance",
 * "for 3 seconds". "For every / for each [X Dude]" is a per-copy bonus, not a trigger.
 */
export function isConditional(desc: Token[]): boolean {
  return firstClause(desc).some(([k, t]) => k === 't' && CONDITIONAL.test(t.replaceAll(/\bfor (every|each)\b/gi, '')));
}

export interface Mod {
  stat: string;
  /** Percent: multiplier for HP/AP/AS/Run Speed, points for percentage stats. */
  value: number;
  source: string;
}

export interface ShownStat {
  key: string;
  label: string;
  icon: string;
  base: number;
  value: number;
  percent: boolean;
  /** Human-readable list of what changed it. */
  sources: string[];
  /** Each new source is reduced by the existing value. */
  diminishing: boolean;
  /** For DPS: the stats it's made of (Attack Power × Attack Speed), base and buffed. */
  factors?: { key: string; label: string; icon: string; base: number; value: number }[];
}

export interface EntryStats {
  stats: ShownStat[];
  /** Dudes of this Dude's Family on the Roster (null for Regular Dude). */
  familyCount: number | null;
}

const nameIs = (text: string, dude: string) => {
  const n = dudeById.get(dude)?.name;
  return !!n && (text === n || text === `${n}s`);
};

/** First sentence of a description, as tokens. */
function firstSentence(desc: Token[]): Token[] {
  const out: Token[] = [];
  for (const tok of desc) {
    const end = tok[0] === 't' ? tok[1].search(/[.!]/) : -1;
    if (end >= 0) {
      out.push(['t', tok[1].slice(0, end)]);
      break;
    }
    out.push(tok);
  }
  return out;
}

/**
 * The first sentence up to where a new clause starts: ", and his Blood Pump grants…" begins a
 * new clause, but ", and [20%] [Deflection]" just continues a list of stats.
 */
function firstClause(desc: Token[]): Token[] {
  const sentence = firstSentence(desc);
  const out: Token[] = [];
  for (let i = 0; i < sentence.length; i++) {
    const [kind, text] = sentence[i];
    const cut = kind === 't' ? text.search(/, and\b/) : -1;
    if (cut >= 0) {
      const rest = text.slice(cut + ', and'.length).trim();
      const next = sentence[i + 1];
      const continuesList = rest === '' && next?.[0] === 'v' && /%$/.test(next[1]);
      if (!continuesList && !/^\[?\d/.test(rest)) {
        out.push(['t', text.slice(0, cut)]);
        return out;
      }
    }
    out.push(sentence[i]);
  }
  return out;
}

interface ParsedBonus {
  /** 'all' | 'wielder' | a Dude id */
  target: string;
  mods: { stat: string; value: number }[];
  /** Multiply by the count of this Dude Type ("per Coach Dude"), capped at maxTimes. */
  perType?: string;
  maxTimes?: number;
}

/** "The [X Dude] gains [20%] [Max HP] and [10%] [Deflection]" and similar always-on bonuses. */
function parseBonus(desc: Token[], rosterTypes: string[]): ParsedBonus | null {
  // Judge only the first clause, so "gains 30% Max HP, and his Blood Pump grants … for 5 seconds"
  // still counts the always-on Max HP.
  const sentence = firstClause(desc);
  // "for every / for each [X Dude]" is a per-copy bonus, not a trigger, so ignore it for this check.
  if (sentence.some(([k, t]) => k === 't' && CONDITIONAL.test(t.replaceAll(/\bfor (every|each)\b/gi, '')))) return null;
  // "gains" is the usual verb; Thagomizer says "Cave Dude get 10% Crit Chance!".
  const gainAt = sentence.findIndex(([k, t]) => k === 't' && /\b(gains?|gets?)\b/.test(t));
  if (gainAt < 0) return null;

  const subject = sentence.slice(0, gainAt + 1);
  const subjectText = subject.map((t) => t[1]).join('');
  let target: string | null = null;
  if (subject.some(([k, t]) => k === 'g' && t === 'Wielder')) target = 'wielder';
  else if (/^(all )?dudes gain/i.test(subjectText.trim())) target = 'all';
  else {
    const named = subject.find(([k, t]) => k === 'v' && rosterTypes.some((d) => nameIs(t, d)));
    if (named) target = rosterTypes.find((d) => nameIs(named[1], d))!;
  }
  if (!target) return null;

  const mods: { stat: string; value: number }[] = [];
  let lastValue: number | null = null;
  let perType: string | undefined;
  let maxTimes: number | undefined;
  const rest = sentence.slice(gainAt + 1);
  rest.forEach(([k, t], i) => {
    if (k === 'v' && t.endsWith('%')) lastValue = Number.parseFloat(t);
    if (k === 'g' && TERM[t] && lastValue !== null) mods.push({ stat: TERM[t], value: lastValue });
    if (k === 'v' && i > 0 && /(per|for every|for each)\s*$/i.test(rest[i - 1][1])) {
      perType = rosterTypes.find((d) => nameIs(t, d)) ?? '__none__';
    }
    if (k === 'v' && i > 0 && /stacking up to\s*$/i.test(rest[i - 1][1])) maxTimes = Number.parseFloat(t);
  });
  if (!mods.length) return null;
  return { target, mods, perType, maxTimes };
}

/** Relics whose effect depends on the whole Roster: handled by hand rather than parsed. */
const SPECIAL = new Set([
  'Bonfire',
  'Sensitivity Training',
  "Captain's Hat",
  'Caboose',
  'Black Sheep',
  "Lieutenant's Sigil",
  'Assistant Coach',
  'Championship Belt',
  'Employee Award',
  'Warm Bench',
]);

/** Shared lookups for one Roster. */
class Team {
  readonly roster: Entry[];
  readonly types: string[];
  readonly planned: string[];
  readonly mods: Map<string, Mod[]>;

  constructor(comp: Comp) {
    this.roster = comp.roster;
    this.types = comp.roster.map((e) => e.dude);
    this.planned = comp.relics.map((id) => relicById.get(id)?.name ?? '');
    this.mods = new Map(comp.roster.map((e) => [e.key, []]));
  }

  has(name: string) {
    return this.planned.includes(name);
  }

  countOf(dude: string) {
    return this.roster.filter((e) => e.dude === dude).reduce((s, e) => s + e.count, 0);
  }

  familyCount(family: string) {
    return this.roster.filter((e) => familyOf(e.dude) === family).reduce((s, e) => s + e.count, 0);
  }

  add(e: Entry, stat: string, value: number, source: string) {
    this.mods.get(e.key)!.push({ stat, value, source });
  }
}

const familyOf = (dude: string) => dudeById.get(dude)?.family ?? null;

/** Mob Mentality: +2% Attack Power and Max HP per extra Regular Dude. */
function abilityMods(team: Team) {
  const regulars = team.countOf('basic');
  if (regulars < 2) return;
  for (const e of team.roster.filter((x) => x.dude === 'basic')) {
    team.add(e, 'damage', 2 * (regulars - 1), 'Mob Mentality');
    team.add(e, 'hpmax', 2 * (regulars - 1), 'Mob Mentality');
  }
}

/** Bonfire: +1% Max HP per Dude of the same Family, up to 20%. */
function bonfire(team: Team) {
  for (const e of team.roster) {
    const f = familyOf(e.dude);
    if (f) team.add(e, 'hpmax', Math.min(20, team.familyCount(f)), 'Bonfire');
  }
}

/** Sensitivity Training: +4% Attack Power per Family on the Roster. */
function sensitivityTraining(team: Team) {
  const fams = new Set(team.roster.map((e) => familyOf(e.dude)).filter(Boolean)).size;
  for (const e of team.roster) team.add(e, 'damage', 4 * fams, 'Sensitivity Training');
}

/** Championship Belt: the most numerous Dude Type gets +30% Attack Power. */
function championshipBelt(team: Team) {
  let top = team.types[0];
  for (const t of team.types) if (team.countOf(t) > team.countOf(top)) top = t;
  for (const e of team.roster.filter((x) => x.dude === top)) team.add(e, 'damage', 30, 'Championship Belt');
}

/** Relics that depend on the whole Roster: Family counts, top or end of the Roster, the biggest type. */
function rosterRelicMods(team: Team) {
  const { roster } = team;
  if (!roster.length) return;
  if (team.has('Bonfire')) bonfire(team);
  if (team.has('Sensitivity Training')) sensitivityTraining(team);
  if (team.has('Championship Belt')) championshipBelt(team);
  for (const [name, rule] of Object.entries(POSITION_RELICS)) {
    if (!team.has(name) || !rule.mods.length) continue;
    const target = positionTarget(roster, rule);
    if (!target) continue;
    const times = rule.perOwner ? Math.min(team.countOf(rule.perOwner), rule.maxTimes ?? Infinity) : 1;
    const boost = rule.quadrupleFor === target.dude ? 4 : 1;
    for (const m of rule.mods) team.add(target, m.stat, m.value * times * boost, name);
  }
}

/**
 * Relics that buff one Roster position, not a Dude Type or Family.
 * slot: 'top' | 'end' | a 1-based position | 'below' (the Dude Type right below `owner`).
 */
export interface PositionRule {
  slot: 'top' | 'end' | 'below' | number;
  /** For slot 'below': whose position it's measured from. */
  owner?: string;
  mods: { stat: string; value: number }[];
  /** Multiply by this Dude's count (e.g. "per Coach Dude"), capped at maxTimes. */
  perOwner?: string;
  maxTimes?: number;
  /** "Quadrupled if the target is a Regular Dude". */
  quadrupleFor?: string;
  /** What it does when it isn't a stat (e.g. a taunt). */
  effect?: string;
}

export const POSITION_RELICS: Record<string, PositionRule> = {
  "Captain's Hat": { slot: 'top', mods: [{ stat: 'damage', value: 30 }] },
  Caboose: { slot: 'end', mods: [{ stat: 'hpmax', value: 30 }] },
  'Black Sheep': { slot: 'end', mods: [], effect: 'taunts up to 5 enemies when battle starts' },
  "Lieutenant's Sigil": { slot: 3, mods: [{ stat: 'crit_chance', value: 10 }] },
  'Assistant Coach': {
    slot: 'below',
    owner: 'coach',
    mods: [
      { stat: 'hpmax', value: 1 },
      { stat: 'regeneration', value: 0.3 },
    ],
    perOwner: 'coach',
    maxTimes: 20,
    quadrupleFor: 'basic',
  },
};

/** The Roster entry a position Relic lands on, or null if that slot is empty. */
export function positionTarget(roster: Entry[], rule: PositionRule): Entry | null {
  if (!roster.length) return null;
  if (rule.slot === 'top') return roster[0];
  if (rule.slot === 'end') return roster.at(-1)!;
  if (rule.slot === 'below') {
    const i = roster.findIndex((e) => e.dude === rule.owner);
    return i >= 0 ? (roster[i + 1] ?? null) : null;
  }
  return roster[rule.slot - 1] ?? null;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** "at the top of your Roster", "third on your Roster", "right below Coach Dude". */
export function slotLabel(rule: PositionRule): string {
  if (rule.slot === 'top') return 'at the top of your Roster';
  if (rule.slot === 'end') return 'at the end of your Roster';
  if (rule.slot === 'below') return `right below ${dudeById.get(rule.owner ?? '')?.name ?? 'its owner'}`;
  return `${ORDINAL[rule.slot - 1] ?? `#${rule.slot}`} on your Roster`;
}

/** Relics that reach neighbours on the Roster. */
function neighbourRelicMods(team: Team) {
  const { roster } = team;
  const doubled = team.countOf('football') >= 12 ? 2 : 1;
  roster.forEach((e, i) => {
    if (team.has('Employee Award') && e.dude === 'manager') {
      for (const t of [e, roster[i + 1]].filter(Boolean)) {
        team.add(t, 'hpmax', 20, 'Employee Award');
        team.add(t, 'deflection', 10, 'Employee Award');
      }
    }
    if (team.has('Warm Bench') && e.dude === 'football') {
      for (const t of [roster[i - 1], e, roster[i + 1]].filter(Boolean)) {
        team.add(t, 'damage', 10 * doubled, 'Warm Bench');
        team.add(t, 'toughness', 5 * doubled, 'Warm Bench');
      }
    }
  });
}

function targetsOf(team: Team, b: ParsedBonus, wielder?: Entry): Entry[] {
  if (b.target === 'all') return team.roster;
  if (b.target === 'wielder') return wielder ? [wielder] : [];
  return team.roster.filter((e) => e.dude === b.target);
}

function applyParsed(team: Team, b: ParsedBonus, source: string, wielder?: Entry) {
  let times = 1;
  if (b.perType === '__none__') times = 0;
  else if (b.perType) times = Math.min(team.countOf(b.perType), b.maxTimes ?? Infinity);
  if (!times) return;
  for (const t of targetsOf(team, b, wielder)) for (const m of b.mods) team.add(t, m.stat, m.value * times, source);
}

/** Everything else: "X gains N% Stat" from planned Relics and each Dude's Trinket. */
function parsedMods(team: Team, comp: Comp) {
  for (const id of comp.relics) {
    const r = relicById.get(id);
    if (!r || SPECIAL.has(r.name)) continue;
    const b = parseBonus(r.desc, team.types);
    if (b && b.target !== 'wielder') applyParsed(team, b, r.name);
  }
  for (const e of team.roster) {
    const tr = e.trinket ? trinketById.get(e.trinket) : null;
    const b = tr ? parseBonus(tr.desc, team.types) : null;
    if (tr && b) applyParsed(team, b, tr.name, e);
  }
}

const describe = (m: Mod, withStat: boolean) => {
  const amount = `${m.source} +${Math.round(m.value * 10) / 10}%`;
  return withStat ? `${amount} ${labelOf(m.stat)}` : amount;
};

/** Base stat plus its buffs, for one shown stat. */
function combine(base: number, key: string, list: Mod[]): { value: number; sources: string[] } {
  const pctFor = (stat: string) => list.filter((m) => m.stat === stat).reduce((s, m) => s + m.value, 0);
  if (key === 'dps') {
    const parts = list.filter((m) => m.stat === 'damage' || m.stat === 'attack_speed');
    return {
      value: base * (1 + pctFor('damage') / 100) * (1 + pctFor('attack_speed') / 100),
      sources: parts.map((m) => describe(m, true)),
    };
  }
  const own = list.filter((m) => m.stat === key);
  if (MULTIPLICATIVE.has(key)) return { value: base * (1 + pctFor(key) / 100), sources: own.map((m) => describe(m, false)) };
  if (DIMINISHING.has(key)) return diminish(base, own);
  return { value: base + pctFor(key), sources: own.map((m) => describe(m, false)) };
}

/** Apply a Diminishing Stat's sources one by one, reporting what each one actually added. */
function diminish(base: number, mods: Mod[]): { value: number; sources: string[] } {
  let current = base / 100;
  const sources: string[] = [];
  for (const m of mods) {
    const gain = (m.value / 100) * (1 - current);
    current += gain;
    const listed = Math.round(m.value * 10) / 10;
    const actual = Math.round(gain * 1000) / 10;
    sources.push(actual === listed ? describe(m, false) : `${m.source} +${listed}%, adds ${actual}% after diminishing`);
  }
  return { value: current * 100, sources };
}

const CORE = new Set(['hpmax', 'dps', 'speed']);

/** DPS = Attack Power × Attack Speed; shown in the DPS tooltip. */
const DPS_FACTORS = [
  { key: 'damage', label: 'Attack Power', icon: 'sp_stat_damage' },
  { key: 'attack_speed', label: 'Attack Speed', icon: 'sp_stat_attack_speed' },
];

/**
 * Relics that trigger off a Dude's *timed* ability ("Every N seconds…"), so they fire reliably.
 * Their buffs count as stats, scaled by uptime = buff duration ÷ ability interval (capped at 1).
 * Targets: self = the owner, below/above = the Dude Type next to him on the Roster,
 * spread = one random other Dude at a time (shared evenly across your other Dudes).
 * One stack is counted; more copies of the owner can stack some of these higher.
 */
export interface TimedRule {
  owner: string;
  ability: string;
  targets: ('self' | 'below' | 'above' | 'spread')[];
  mods: { stat: string; value: number }[];
  uptime: number;
  /** Multiply the bonus by the owner's count (e.g. "per Broadcaster Dude"). */
  perOwner?: boolean;
  /** Shown in the relic grade, e.g. that nearby Dudes may benefit too. */
  note?: string;
}

export const TIMED_RULES: Record<string, TimedRule> = {
  'Imposing Podium': { owner: 'general', ability: 'Tactical Command', targets: ['below'], mods: [{ stat: 'toughness', value: 10 }], uptime: 1, note: 'More General Dudes stack it higher (up to 5).' },
  'Combat Radio': {
    owner: 'general',
    ability: 'Tactical Command',
    targets: ['below'],
    mods: [
      { stat: 'damage', value: 15 },
      { stat: 'crit_chance', value: 5 },
      { stat: 'cleave', value: 30 },
    ],
    uptime: 1,
    note: 'More General Dudes stack it higher (up to 10).',
  },
  'Shock Helmet': { owner: 'trooper', ability: 'Orbital Strike', targets: ['self'], mods: [{ stat: 'toughness', value: 10 }], uptime: 1 },
  'Handheld Microphone': { owner: 'broadcaster', ability: 'Play by Play', targets: ['self'], mods: [{ stat: 'block_chance', value: 20 }], uptime: 2 / 3 },
  'UFO Wax': { owner: 'alien', ability: 'Tractor Beam', targets: ['self', 'above'], mods: [{ stat: 'deflection', value: 15 }], uptime: 1 },
  'RAD Infusion': {
    owner: 'alien',
    ability: 'Tractor Beam',
    targets: ['above'],
    mods: [
      { stat: 'damage', value: 25 },
      { stat: 'crit_chance', value: 5 },
    ],
    uptime: 2 / 3,
  },
  'Supply Drop': {
    owner: 'trooper',
    ability: 'Orbital Strike',
    targets: ['self'],
    mods: [
      { stat: 'damage', value: 5 },
      { stat: 'attack_speed', value: 2 },
      { stat: 'crit_chance', value: 1 },
    ],
    uptime: 0.5,
    note: 'Counted for the Trooper only; Dudes near the strike may also get it.',
  },
  'Knee Sleeve': { owner: 'basketball', ability: 'Dunk', targets: ['self'], mods: [{ stat: 'evasion', value: 5 }], uptime: 4 / 7, note: 'Counted for the Basketball Dude only; nearby Dudes may also get it.' },
  'Tall Socks': { owner: 'basketball', ability: 'Dunk', targets: ['self'], mods: [{ stat: 'crit_chance', value: 1 }], uptime: 4 / 7, note: 'Counted for the Basketball Dude only; nearby Dudes may also get it.' },
  Spurs: {
    owner: 'western',
    ability: 'Lasso',
    targets: ['self'],
    mods: [
      { stat: 'crit_chance', value: 2 },
      { stat: 'damage', value: 5 },
    ],
    uptime: 1,
    note: 'Counted for the Cowboy only; nearby Dudes may also get it.',
  },
  Moonshine: { owner: 'western', ability: 'Lasso', targets: ['spread'], mods: [{ stat: 'toughness', value: 30 }], uptime: 1, note: 'Lassoed Dudes are random, so the bonus is shared across your other Dudes.' },
  'Trophy Cup': {
    owner: 'broadcaster',
    ability: 'Play by Play',
    targets: ['spread'],
    mods: [
      { stat: 'damage', value: 10 },
      { stat: 'cleave', value: 10 },
      { stat: 'crit_chance', value: 1 },
    ],
    uptime: 1,
    perOwner: true,
    note: 'The MVP is random, so the bonus is shared across your other Dudes.',
  },
};

/** Why a timed Relic does nothing right now (e.g. nothing below the General), or null if it works. */
export function timedTargetIssue(comp: Comp, relicName: string): string | null {
  const rule = TIMED_RULES[relicName];
  if (!rule) return null;
  const i = comp.roster.findIndex((e) => e.dude === rule.owner);
  if (i < 0) return null;
  const owner = dudeById.get(rule.owner)?.name ?? rule.owner;
  if (rule.targets.includes('below') && !comp.roster[i + 1]) return `No Dude Type below ${owner}: ${rule.ability} has no target.`;
  if (rule.targets.includes('above') && rule.targets.length === 1 && i === 0) return `No Dude Type above ${owner}: ${rule.ability} has no target.`;
  if (rule.targets.includes('spread') && comp.roster.every((e) => e.dude === rule.owner)) return `No other Dudes for ${rule.ability} to target.`;
  return null;
}

function timedTargets(team: Team, rule: TimedRule, i: number): { entry: Entry; share: number }[] {
  const { roster } = team;
  const out: { entry: Entry; share: number }[] = [];
  for (const t of rule.targets) {
    if (t === 'self') out.push({ entry: roster[i], share: 1 });
    if (t === 'below' && roster[i + 1]) out.push({ entry: roster[i + 1], share: 1 });
    if (t === 'above' && roster[i - 1]) out.push({ entry: roster[i - 1], share: 1 });
    if (t === 'spread') {
      const others = roster.filter((e) => e.dude !== rule.owner);
      const otherDudes = others.reduce((s, e) => s + e.count, 0);
      // One target at a time (per owner, unless the bonus already scales per owner), spread over every other Dude.
      const active = rule.perOwner ? 1 : team.countOf(rule.owner);
      for (const e of others) out.push({ entry: e, share: Math.min(1, active / Math.max(1, otherDudes)) });
    }
  }
  return out;
}

/** Reliable-trigger Relics (see TIMED_RULES), applied as uptime-weighted stats. */
function timedMods(team: Team) {
  for (const [name, rule] of Object.entries(TIMED_RULES)) {
    if (!team.has(name)) continue;
    const i = team.roster.findIndex((e) => e.dude === rule.owner);
    if (i < 0) continue;
    const scale = rule.uptime * (rule.perOwner ? team.countOf(rule.owner) : 1);
    for (const { entry, share } of timedTargets(team, rule, i)) {
      for (const m of rule.mods) team.add(entry, m.stat, m.value * scale * share, name);
    }
  }
}

export function teamStats(comp: Comp): Map<string, EntryStats> {
  const team = new Team(comp);
  abilityMods(team);
  rosterRelicMods(team);
  neighbourRelicMods(team);
  parsedMods(team, comp);
  timedMods(team);

  const out = new Map<string, EntryStats>();
  for (const e of team.roster) {
    const d = dudeById.get(e.dude)!;
    const list = team.mods.get(e.key)!;
    const stats: ShownStat[] = [];
    for (const s of SHOWN_STATS) {
      const base = statNum(d, s.key);
      const { value, sources } = combine(base, s.key, list);
      const core = CORE.has(s.key);
      if (core || value > 0) {
        const shown: ShownStat = { key: s.key, label: s.label, icon: s.icon, base, value, percent: !core, sources, diminishing: DIMINISHING.has(s.key) };
        if (s.key === 'dps') shown.factors = DPS_FACTORS.map((f) => ({ ...f, base: statNum(d, f.key), value: combine(statNum(d, f.key), f.key, list).value }));
        stats.push(shown);
      }
    }
    const f = familyOf(e.dude);
    out.set(e.key, { stats, familyCount: f ? team.familyCount(f) : null });
  }
  return out;
}

const labelOf = (stat: string) => Object.entries(TERM).find(([, v]) => v === stat)?.[0] ?? stat;
