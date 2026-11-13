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
const CONDITIONAL = /\b(when|whenever|if|every|while|after|before|chance|during|once|seconds?|until|first|instead)\b/i;

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
    if (tok[0] === 't' && tok[1].includes('.')) {
      out.push(['t', tok[1].slice(0, tok[1].indexOf('.'))]);
      break;
    }
    out.push(tok);
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
  const sentence = firstSentence(desc);
  // "for every / for each [X Dude]" is a per-copy bonus, not a trigger, so ignore it for this check.
  if (sentence.some(([k, t]) => k === 't' && CONDITIONAL.test(t.replaceAll(/\bfor (every|each)\b/gi, '')))) return null;
  const gainAt = sentence.findIndex(([k, t]) => k === 't' && /\bgains?\b/.test(t));
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
const SPECIAL = new Set(['Bonfire', 'Sensitivity Training', "Captain's Hat", 'Caboose', 'Championship Belt', 'Employee Award', 'Warm Bench']);

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
  if (team.has("Captain's Hat")) team.add(roster[0], 'damage', 30, "Captain's Hat");
  if (team.has('Caboose')) team.add(roster.at(-1)!, 'hpmax', 30, 'Caboose');
  if (team.has('Championship Belt')) championshipBelt(team);
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

export function teamStats(comp: Comp): Map<string, EntryStats> {
  const team = new Team(comp);
  abilityMods(team);
  rosterRelicMods(team);
  neighbourRelicMods(team);
  parsedMods(team, comp);

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
