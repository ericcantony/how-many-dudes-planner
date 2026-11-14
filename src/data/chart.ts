import { dudeById, relics, type Relic, type Token } from './game';
import gradesJson from './grades.json';

/**
 * Synergy chart by u/esmgcito, from their r/HowManyDudes post ("Dude classes are difficult to remember"). A later
 * spreadsheet of theirs changed 14 cells; each was checked against the Dudex text (2026-11-14) and kept. Family rows =
 * that Family's Relics; Dude rows = the Dude's own Relics plus his ability. Each cell marks how the row relates to a stat:
 *   G = its Relics/ability give the stat to any Dude Type (including itself)
 *   Y = gives the stat to other Dude Types
 *   B = gives the stat only to itself (strong self-scaler)
 *   D = scales with the stat, but no Relic of its own grants it
 *   R = affects enemies
 * The author said the spreadsheet had wrong cells and withdrew it, so none of its grades are used. Users report wrong
 * cells; fix them here. Strength grades (S–F) are our own estimates from the Dudex text: run `npm run grades`
 * (scripts/grades.mjs → grades.json; Healing in HP/s from scripts/heal-sources.mjs). Temp HP, Revive and the like have no grade.
 * To fix a cell, edit the row: "column:Letter" pairs separated by spaces.
 */
export type Cell = 'G' | 'Y' | 'B' | 'D' | 'R';
export type ColGroup = 'offense' | 'defense' | 'support' | 'enemy';

export interface Column {
  id: string;
  label: string;
  short: string;
  group: ColGroup;
  icon?: string;
  /** Glossary term Relics use when they grant this stat ("gains 10% Crit Chance"). */
  relicTerm?: string;
}

export const COLUMNS: Column[] = [
  { id: 'atk_spd', label: 'Attack Speed', short: 'Atk Spd', group: 'offense', icon: 'sp_stat_attack_speed', relicTerm: 'Attack Speed' },
  { id: 'atk_pow', label: 'Attack Power', short: 'Atk Pow', group: 'offense', icon: 'sp_stat_damage', relicTerm: 'Attack Power' },
  { id: 'cleave', label: 'Cleave', short: 'Cleave', group: 'offense', icon: 'sp_stat_cleave', relicTerm: 'Cleave' },
  { id: 'multihit', label: 'Multistrike', short: 'Multihit', group: 'offense', icon: 'sp_stat_multistrike', relicTerm: 'Multistrike' },
  { id: 'crit', label: 'Crit Chance', short: 'Crit %', group: 'offense', icon: 'sp_stat_critchance', relicTerm: 'Crit Chance' },
  { id: 'crit_dmg', label: 'Crit Damage', short: 'Crit Dmg', group: 'offense', icon: 'sp_stat_critdamage', relicTerm: 'Crit Damage' },
  { id: 'lifesteal', label: 'Lifesteal', short: 'Lifesteal', group: 'offense', icon: 'sp_stat_lifesteal', relicTerm: 'Lifesteal' },
  { id: 'max_hp', label: 'Max HP', short: 'Max HP', group: 'defense', icon: 'sp_stat_maxhp', relicTerm: 'Max HP' },
  { id: 'temp_hp', label: 'Temporary Health', short: 'Temp HP', group: 'defense', relicTerm: 'Temporary Health' },
  { id: 'evasion', label: 'Evasion', short: 'Evasion', group: 'defense', icon: 'sp_stat_evasion', relicTerm: 'Evasion' },
  { id: 'block', label: 'Block Chance', short: 'Block', group: 'defense', icon: 'sp_stat_block_chance', relicTerm: 'Block Chance' },
  { id: 'toughness', label: 'Toughness', short: 'Toughness', group: 'defense', icon: 'sp_stat_toughness', relicTerm: 'Toughness' },
  { id: 'deflect', label: 'Deflection', short: 'Deflect', group: 'defense', icon: 'sp_ui_staticon_deflection', relicTerm: 'Deflection' },
  { id: 'heal', label: 'Healing', short: 'Heal', group: 'support' },
  { id: 'regen', label: 'Regeneration', short: 'Regen', group: 'support', icon: 'sp_stat_regeneration', relicTerm: 'Regeneration' },
  { id: 'heal_recv', label: 'Healing Received', short: 'Heal Recv', group: 'support', icon: 'sp_stat_healing_surge', relicTerm: 'Healing Received' },
  { id: 'revive', label: 'Revive', short: 'Revive', group: 'support' },
  { id: 'summon', label: 'Summon', short: 'Summon', group: 'support' },
  { id: 'dash', label: 'Dash', short: 'Dash', group: 'support' },
  { id: 'run_spd', label: 'Run Speed', short: 'Run Spd', group: 'support', icon: 'sp_stat_speed', relicTerm: 'Run Speed' },
  { id: 'taunt', label: 'Taunt', short: 'Taunt', group: 'support' },
  { id: 'miss', label: 'Miss Chance', short: 'Miss %', group: 'enemy', icon: 'sp_stat_miss_chance' },
  { id: 'crit_exp', label: 'Crit Exposure', short: 'Crit exp', group: 'enemy', icon: 'sp_icon_bullseye' },
  { id: 'clv_down', label: 'Cleave Damage Down', short: 'Clv down', group: 'enemy', icon: 'sp_icon_target' },
  { id: 'atk_down', label: 'Attack Power Down', short: 'Atk down', group: 'enemy' },
  { id: 'vuln', label: 'Vulnerability', short: 'Vulnerable', group: 'enemy', icon: 'sp_stat_vulnerability' },
  { id: 'stun', label: 'Stun', short: 'Stun', group: 'enemy' },
];
export const columnById = new Map(COLUMNS.map((c) => [c.id, c]));

/** Columns you can build a comp around (enemy debuffs are not build stats). */
export const FOCUS_COLUMNS = COLUMNS.filter((c) => c.group !== 'enemy');

export const CELL_LABELS: Record<Cell, string> = {
  G: 'Gives it to any Dude Type',
  Y: 'Gives it to other Dude Types',
  B: 'Gives it only to himself',
  D: 'Scales with it (no Relic grants it)',
  R: 'Affects enemies',
};

const ROWS: Record<string, string> = {
  'family:warrior': 'cleave:G crit:G max_hp:G temp_hp:G block:G toughness:G run_spd:G',
  ninja: 'atk_spd:G atk_pow:D multihit:B crit:B crit_dmg:B max_hp:B evasion:B miss:R',
  samurai: 'atk_spd:D atk_pow:B cleave:B crit:B crit_dmg:B max_hp:B temp_hp:B deflect:B heal:B dash:B run_spd:B',
  general: 'atk_spd:D atk_pow:G cleave:Y crit:Y max_hp:B temp_hp:G toughness:G heal:Y taunt:Y crit_exp:R',
  knight: 'atk_spd:D crit:D max_hp:B temp_hp:G toughness:G heal_recv:D taunt:B crit_exp:R',
  viking: 'atk_spd:G atk_pow:B cleave:G max_hp:B temp_hp:G toughness:G revive:B run_spd:G',
  medic: 'atk_spd:G atk_pow:B crit:G max_hp:B temp_hp:G toughness:G heal:G revive:B dash:B run_spd:B',
  spartan: 'atk_pow:B crit:Y max_hp:B temp_hp:Y block:G toughness:B deflect:G',

  'family:undead': 'atk_spd:G lifesteal:G heal:G regen:G heal_recv:G summon:G run_spd:G clv_down:R',
  zombie: 'atk_pow:B max_hp:G regen:B heal_recv:B revive:B run_spd:G taunt:B',
  vampire: 'atk_spd:D atk_pow:B cleave:B lifesteal:G max_hp:D temp_hp:B heal:G revive:B atk_down:R',
  ghost: 'atk_spd:D atk_pow:B lifesteal:G max_hp:G temp_hp:G evasion:G heal:G regen:G vuln:R',
  frankendude: 'atk_spd:G atk_pow:B max_hp:B toughness:G heal:Y regen:B revive:G run_spd:B',
  necromancer: 'atk_spd:G atk_pow:Y crit:G max_hp:G toughness:Y heal:Y revive:B summon:B taunt:Y',
  mummy: 'atk_spd:D atk_pow:B crit:B crit_dmg:B max_hp:B heal:G revive:B miss:R',
  lich: 'atk_pow:Y cleave:Y crit:Y max_hp:B heal:G revive:Y summon:Y taunt:B',

  'family:action': 'atk_spd:G atk_pow:G crit:G crit_dmg:G evasion:G toughness:G taunt:G',
  agent: 'atk_spd:G atk_pow:B cleave:B crit:Y max_hp:B temp_hp:Y evasion:Y toughness:B deflect:G revive:Y dash:B run_spd:B',
  assassin: 'atk_spd:D atk_pow:B max_hp:B evasion:B miss:R atk_down:R vuln:R',
  cave: 'atk_pow:G crit:B max_hp:G toughness:G revive:B',
  western: 'atk_spd:D atk_pow:G crit:G toughness:G revive:Y dash:Y run_spd:B atk_down:R vuln:R',
  explorer: 'atk_spd:D atk_pow:B temp_hp:G block:G heal:G heal_recv:G revive:B dash:B run_spd:D atk_down:R',
  hacker: 'atk_spd:D atk_pow:G crit:G crit_dmg:B max_hp:B temp_hp:G revive:Y',
  pirate: 'crit:B crit_dmg:B max_hp:B evasion:G heal:B heal_recv:B revive:B taunt:B',

  'family:employed': 'atk_spd:G atk_pow:G max_hp:G toughness:G deflect:G revive:G',
  chef: 'atk_spd:G atk_pow:G crit:G temp_hp:G block:B toughness:B heal:G',
  construction: 'atk_spd:B atk_pow:Y crit:Y max_hp:B temp_hp:B toughness:B heal:B revive:B dash:B taunt:B clv_down:R stun:R',
  dentist: 'atk_spd:G crit:B temp_hp:G toughness:G heal:G regen:G run_spd:G',
  electrician: 'atk_spd:G atk_pow:B cleave:B max_hp:B evasion:G revive:B run_spd:B',
  farmer: 'atk_pow:B cleave:B max_hp:B temp_hp:B toughness:B heal:Y regen:G heal_recv:D revive:B taunt:B',
  finance: 'atk_pow:G cleave:G max_hp:G evasion:B deflect:B revive:B run_spd:G',
  manager: 'atk_spd:Y crit:Y max_hp:G deflect:G heal:G revive:B',

  'family:fantasy': 'crit:G temp_hp:G evasion:G deflect:G revive:G',
  bard: 'atk_spd:B atk_pow:G max_hp:B temp_hp:B evasion:G toughness:G run_spd:G',
  cleric: 'atk_spd:D atk_pow:B multihit:G temp_hp:G evasion:G toughness:B heal:G heal_recv:G revive:B',
  druid: 'atk_spd:D atk_pow:G cleave:B multihit:B crit:B lifesteal:B temp_hp:B toughness:G revive:B dash:B',
  paladin: 'atk_pow:G max_hp:B toughness:Y heal:B heal_recv:B revive:B run_spd:Y stun:R',
  ranger: 'atk_spd:D atk_pow:G crit:B max_hp:B evasion:G vuln:R',
  warlock: 'atk_spd:B atk_pow:B crit:G lifesteal:B max_hp:B taunt:B',
  wizard: 'atk_spd:D atk_pow:G crit:B crit_dmg:B temp_hp:B revive:B run_spd:D',

  'family:scifi': 'atk_spd:G temp_hp:G toughness:G deflect:G regen:G revive:G',
  alien: 'atk_spd:D atk_pow:Y crit:Y max_hp:B temp_hp:Y deflect:G regen:B revive:Y dash:Y',
  cyborg: 'atk_spd:D atk_pow:B multihit:B crit:G max_hp:B toughness:B deflect:G revive:B run_spd:B',
  mutant: 'atk_spd:B atk_pow:G cleave:G toughness:G heal:G regen:B heal_recv:G dash:B',
  psionic: 'max_hp:B temp_hp:B toughness:B deflect:G taunt:B atk_down:R vuln:R',
  quantum: 'atk_spd:D max_hp:B temp_hp:G evasion:G deflect:G heal:G regen:B revive:G summon:B run_spd:D',
  time: 'atk_spd:Y max_hp:B toughness:G revive:B run_spd:Y',
  trooper: 'atk_spd:G atk_pow:G crit:G max_hp:B toughness:B revive:B',

  'family:sports': 'atk_pow:G crit:G temp_hp:G heal:G regen:G run_spd:G miss:R crit_exp:R vuln:R',
  basketball: 'atk_spd:D atk_pow:B multihit:G crit:G max_hp:B evasion:G miss:R vuln:R',
  broadcaster: 'atk_pow:Y cleave:G crit:Y max_hp:B temp_hp:G block:B toughness:G miss:R vuln:R',
  coach: 'atk_spd:B multihit:G max_hp:G temp_hp:G block:G deflect:B heal:G regen:G revive:Y run_spd:G',
  football: 'atk_pow:G max_hp:B block:G toughness:G regen:G revive:B dash:G vuln:R',
  hockey: 'atk_pow:G crit:G max_hp:B block:B deflect:G run_spd:G taunt:B',
  soccer: 'atk_spd:B atk_pow:B evasion:B block:G toughness:B revive:B run_spd:B',
  tennis: 'atk_spd:D atk_pow:B cleave:B crit:B crit_dmg:B max_hp:B evasion:B toughness:B miss:R',
  nude: 'max_hp:D run_spd:D',

  'group:universal': 'atk_spd:G atk_pow:G cleave:G crit:G max_hp:G temp_hp:G toughness:G heal:G heal_recv:G revive:G summon:G run_spd:G taunt:G vuln:R stun:R',
  basic: 'atk_pow:B max_hp:B',
};

/** Strength grade: a cell's estimated amount vs the best Dude in that column. */
export type ChartGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const GRADE_LABELS: Record<ChartGrade, string> = {
  S: 'the best Dude, or within 5% of him',
  A: '85–95% of the best',
  B: '70–85% of the best',
  C: '50–70% of the best',
  D: '30–50% of the best',
  E: '20–30% of the best',
  F: 'under 20% of the best',
};

interface Amount {
  v: number;
  g: ChartGrade;
}
interface GradeCell {
  self?: Amount;
  team?: Amount;
  src: string[];
}
interface GradeFile {
  best: Record<'self' | 'team', Record<string, { v: number; key: string }>>;
  rows: Record<string, Record<string, GradeCell>>;
}
const GRADES = gradesJson as GradeFile;

/** What a grade measures, and where its number comes from. */
export interface GradeInfo {
  grade: ChartGrade;
  /** team = given to teammates (G/Y cells), self = given to himself (B cells). */
  kind: 'team' | 'self';
  /** Estimated %. */
  value: number;
  /** "%" for stats, " HP/s" for Healing. */
  unit: string;
  /** The best Dude in the column, e.g. "7.2% (Quantum Dude)". */
  best?: string;
  /** Relics and abilities behind the number. */
  sources: string[];
}

/** "col:Cell" pairs. */
function parse(row: string): Map<string, Cell> {
  return new Map(
    row
      .split(' ')
      .filter(Boolean)
      .map((pair) => {
        const [col, cell] = pair.split(':');
        return [col, cell as Cell];
      }),
  );
}

const parsed = new Map(Object.entries(ROWS).map(([k, v]) => [k, parse(v)]));

/** Dude ids that have a chart row, in chart order (grouped by Family). */
export const CHART_DUDES = [...parsed.keys()].filter((k) => !k.includes(':') && k !== 'basic');

/** Rows for Relics outside the Families: Universal (Relics any comp can find). */
export const GROUP_ROWS = [{ id: 'universal', name: 'Universal Relics' }];
export const groupCells = (id: string) => parsed.get(`group:${id}`);

/** Cells for a Dude id, or undefined if the chart has no row for him (summons). Regular Dude (basic) has a row. */
export const dudeCells = (dudeId: string) => parsed.get(dudeId);
export const familyCells = (familyId: string) => parsed.get(`family:${familyId}`);
export const cellOf = (dudeId: string, col: string) => parsed.get(dudeId)?.get(col);
export const inChart = (dudeId: string) => parsed.has(dudeId);

export const givesToTeam = (c: Cell | undefined) => c === 'G' || c === 'Y';
export const scales = (c: Cell | undefined) => c === 'B' || c === 'D';

const unitOf = (col: string) => (col === 'heal' ? ' HP/s' : '%');

function bestLabel(kind: 'self' | 'team', col: string) {
  const b = GRADES.best[kind][col];
  return b ? `${b.v}${unitOf(col)} (${dudeById.get(b.key)?.name ?? b.key})` : undefined;
}

/**
 * Grade of a row's cell ("family:x" and "group:x" keys work too), matched to its colour: G/Y cells grade what he
 * gives teammates, B cells what he gives himself (both estimated by scripts/grades.mjs from the Dudex text).
 */
export function gradeInfo(key: string, col: string): GradeInfo | undefined {
  const cell = cellOf(key, col);
  let kind: 'self' | 'team' | undefined;
  if (givesToTeam(cell)) kind = 'team';
  else if (cell === 'B') kind = 'self';
  const g = GRADES.rows[key]?.[col];
  const amount = kind && g?.[kind];
  if (!kind || !g || !amount) return undefined;
  const label = kind === 'team' ? 'Teammates' : 'Himself';
  return {
    grade: amount.g,
    kind,
    value: amount.v,
    unit: unitOf(col),
    best: bestLabel(kind, col),
    sources: g.src.filter((s) => s.startsWith(label)).map((s) => s.slice(label.length + 2)),
  };
}
export const gradeOf = (key: string, col: string) => gradeInfo(key, col)?.grade;

/**
 * How strong a team healer is, 0–1: his estimated HP/s for teammates vs the best healer. A healer the text can't
 * time (Fatal saves, Lifesteal-based) gets 0.15; a Dude who doesn't heal the team gets 0.
 */
export function healStrength(dudeId: string) {
  if (!givesToTeam(cellOf(dudeId, 'heal'))) return 0;
  const v = GRADES.rows[dudeId]?.heal?.team?.v;
  const top = GRADES.best.team.heal?.v;
  return v && top ? v / top : 0.15;
}

const GRADE_WEIGHT: Record<ChartGrade, number> = { S: 1.5, A: 1.35, B: 1.2, C: 1, D: 0.85, E: 0.7, F: 0.55 };
/** A coloured cell whose amount the text doesn't show (procs like Rum Cask, HP-based effects): rated weak, about E. */
const UNKNOWN_WEIGHT = 0.75;
/** Multiplier for a cell's strength: 1 for cells never graded (dark blue, enemy debuffs, Dash, Taunt…). */
export const gradeWeight = (key: string, col: string) => {
  const g = gradeOf(key, col);
  if (g) return GRADE_WEIGHT[g];
  const cell = cellOf(key, col);
  const gradable = (columnById.get(col)?.relicTerm || col === 'heal') && (givesToTeam(cell) || cell === 'B');
  return gradable ? UNKNOWN_WEIGHT : 1;
};

/** Self-scaling cells (B or D): Dudes with many are good anchors to build around. */
export const selfScaling = (dudeId: string) => [...(parsed.get(dudeId)?.values() ?? [])].filter(scales).length;

/**
 * How well a Dude fits the chosen focus stats, following the post's method:
 * teammates with Y (3) or G (2) on those columns, anchors with B/D (1), each weighted by the cell's grade.
 */
export function focusScore(dudeId: string, focus: string[]) {
  let score = 0;
  for (const col of focus) {
    const c = cellOf(dudeId, col);
    let base = 0;
    if (c === 'Y') base = 3;
    else if (c === 'G') base = 2;
    else if (scales(c)) base = 1;
    score += base * gradeWeight(dudeId, col);
  }
  return score;
}

// ----- Relics: which columns does a Relic give? Detected from "gains X% Stat" in its text. -----

const TERM_TO_COL = new Map(COLUMNS.filter((c) => c.relicTerm).map((c) => [c.relicTerm!, c.id]));

/** Plain text allowed between "gains" and the stats it lists: "5% Attack Power and a stacking 2% Max HP". */
const GAIN_FILLER = new Set(['', ',', 'and', ', and', 'a stacking', 'an additional']);

interface WalkState {
  enemySentence: boolean;
  inGain: boolean;
}

/** Update the walk state for a plain-text token. */
function stepText(state: WalkState, text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('enem')) state.enemySentence = true;
  const afterGain = lower.split(/\bgains?\b/);
  if (afterGain.length > 1) {
    state.inGain = !state.enemySentence && GAIN_FILLER.has((afterGain.at(-1) ?? '').trim());
  } else if (!GAIN_FILLER.has(lower.trim())) {
    state.inGain = false;
  }
  if (lower.includes('.')) state.enemySentence = (lower.split('.').at(-1) ?? '').includes('enem');
}

function healsTeam(desc: Token[]) {
  const mentionsEnemy = desc.some(([k, t]) => k === 't' && t.toLowerCase().includes('enem'));
  return !mentionsEnemy && desc.some(([k, t]) => k === 'g' && (t === 'Heal' || t === 'Heals'));
}

/** Walk the tokens: after "gain(s)", each stat term in the list that follows is a stat the Relic gives. */
function relicGives(r: Relic): string[] {
  const out = new Set<string>();
  const state: WalkState = { enemySentence: false, inGain: false };
  for (const [kind, text] of r.desc) {
    if (kind === 't') stepText(state, text);
    else if (kind === 'g' && state.inGain && TERM_TO_COL.has(text)) out.add(TERM_TO_COL.get(text)!);
  }
  if (healsTeam(r.desc)) out.add('heal');
  return [...out];
}

/** Relic id → chart column ids it gives. */
export const RELIC_GIVES = new Map(relics.map((r) => [r.id, relicGives(r)]));
