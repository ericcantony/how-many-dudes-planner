import { relics, type Relic, type Token } from './game';

/**
 * Synergy chart by u/esmgcito, from their r/HowManyDudes post ("Dude classes are difficult to remember")
 * and the spreadsheet they shared (Dudex read 2026-11-06). Family rows = that Family's Relics; Dude rows =
 * the Dude's own Relics plus his ability. Each cell marks how the row relates to a stat:
 *   G = its Relics/ability give the stat to any Dude Type (including itself)
 *   Y = gives the stat to other Dude Types
 *   B = gives the stat only to itself (strong self-scaler)
 *   D = scales with the stat, but no Relic of its own grants it
 *   R = affects enemies
 * After the slash, the strength grade S–F: the stacked total (all his Relics, his Family's and his ability,
 * assuming 30 Dudes) vs the best in that column (`COLUMN_BEST`). "-" = graded only through Family Relics.
 * To fix a cell, edit the row: "column:Letter/Grade" pairs separated by spaces.
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
  'family:warrior': 'cleave:G/F crit:G/D max_hp:G/F temp_hp:G/F block:G/F toughness:G/F run_spd:G/B',
  ninja: 'atk_spd:G/F atk_pow:D cleave:-/F multihit:B/C crit:B/S crit_dmg:B/S max_hp:B/D temp_hp:-/F evasion:B/E block:-/F toughness:-/F run_spd:-/B miss:R/S',
  samurai: 'atk_spd:D atk_pow:B/S cleave:B/E crit:B/S crit_dmg:B/S max_hp:B/C temp_hp:B/D block:-/F toughness:-/F deflect:B/D heal:B/F dash:B run_spd:B/S',
  general: 'atk_spd:D atk_pow:G/D cleave:Y/A crit:Y/S max_hp:B/D temp_hp:G/E block:-/F toughness:G/D heal:Y/E run_spd:-/B taunt:Y/D crit_exp:R/S',
  knight: 'atk_spd:D cleave:-/F crit:D/D max_hp:B/A temp_hp:G/S block:-/F toughness:G/F heal_recv:D run_spd:-/B taunt:B/C crit_exp:R/S',
  viking: 'atk_spd:G/A atk_pow:B/S cleave:G/D crit:-/D max_hp:B/D temp_hp:G/F block:-/F toughness:G/F revive:B/S run_spd:G/A',
  medic: 'atk_spd:G/D atk_pow:B/F cleave:-/F crit:G/C max_hp:B/C temp_hp:G/D block:-/F toughness:G/F heal:G/S revive:B/S dash:B run_spd:B/S',
  spartan: 'atk_pow:B/S cleave:-/F crit:Y/C max_hp:B/D temp_hp:Y/F block:G/A toughness:B/F deflect:G/E run_spd:-/B',

  'family:undead': 'atk_spd:G/F lifesteal:G/D heal:G/F regen:G/F heal_recv:G/F summon:G/S run_spd:G/F clv_down:R/S',
  zombie: 'atk_spd:-/F atk_pow:B/E lifesteal:-/D max_hp:G/B heal:-/F regen:B/D heal_recv:B/C revive:B/F summon:-/S run_spd:G/F taunt:B/E clv_down:-/S',
  vampire: 'atk_spd:D/F atk_pow:B/E cleave:B/E lifesteal:G/A max_hp:D temp_hp:B/F heal:G/D regen:-/F heal_recv:-/F revive:B/S summon:-/S run_spd:-/F clv_down:-/S atk_down:R/C',
  ghost: 'atk_spd:D/F atk_pow:B/S lifesteal:G/C max_hp:G/F temp_hp:G/D evasion:G/E heal:G/D regen:G/D heal_recv:-/F summon:-/S run_spd:-/F clv_down:-/S vuln:R/D',
  frankendude: 'atk_spd:G/C atk_pow:B/S lifesteal:-/D max_hp:B/C toughness:G/F heal:Y/D regen:B/S heal_recv:-/F revive:G/S summon:-/S run_spd:B/F clv_down:-/S',
  necromancer: 'atk_spd:G/D atk_pow:Y/E crit:G/F lifesteal:-/D max_hp:G/S toughness:Y/F heal:Y/E regen:-/F heal_recv:-/F revive:B/S summon:B/S run_spd:-/F taunt:Y/D clv_down:-/S',
  mummy: 'atk_spd:D/F atk_pow:B/S crit:B/F crit_dmg:B/F lifesteal:-/D max_hp:B/C heal:G/F regen:-/F heal_recv:-/F revive:B/S summon:-/S run_spd:-/F miss:R/C clv_down:-/S',
  lich: 'atk_spd:-/F atk_pow:Y/S cleave:Y/S crit:Y/S lifesteal:-/D max_hp:B/S heal:G/F regen:-/F heal_recv:-/F revive:Y/C summon:Y/S run_spd:-/F taunt:B/S clv_down:-/S',

  'family:action': 'atk_spd:G/F atk_pow:G/F crit:G/F crit_dmg:G/F evasion:G/D toughness:G/D taunt:G',
  agent: 'atk_spd:G/C atk_pow:B/S cleave:B/F crit:Y/E crit_dmg:-/F max_hp:B/D temp_hp:Y/F evasion:Y/C toughness:B/C deflect:G/E revive:Y/C dash:B run_spd:B/S',
  assassin: 'atk_spd:D/F atk_pow:B/E crit:-/F crit_dmg:-/F max_hp:B/C evasion:B/D toughness:-/D miss:R/C atk_down:R/S vuln:R/D',
  cave: 'atk_spd:-/F atk_pow:G/S crit:B/E crit_dmg:-/F max_hp:G/E evasion:-/D toughness:G/C revive:B/S',
  western: 'atk_spd:D/F atk_pow:G/F crit:G/E crit_dmg:-/F evasion:-/D toughness:G/C revive:Y/C dash:Y run_spd:B/E atk_down:R/C vuln:R/D',
  explorer: 'atk_spd:D/F atk_pow:B/S crit:-/F crit_dmg:-/F temp_hp:G/F evasion:-/D block:G/D toughness:-/D heal:G/D heal_recv:G/F revive:B/S dash:B run_spd:D atk_down:R/B',
  hacker: 'atk_spd:D/F atk_pow:G/S crit:G/D crit_dmg:B/D max_hp:B/C temp_hp:G/F evasion:-/D toughness:-/D revive:Y/C',
  pirate: 'atk_spd:-/F atk_pow:-/F crit:B/D crit_dmg:B/S max_hp:B/C evasion:G/S toughness:-/D heal:B/F heal_recv:B/E revive:B/S taunt:B/B',

  'family:employed': 'atk_spd:G/F atk_pow:G/S max_hp:G/D toughness:G/D deflect:G/F revive:G/F',
  chef: 'atk_spd:G/F atk_pow:G/S crit:G/F max_hp:-/D temp_hp:G/C block:B/S toughness:B/D deflect:-/F heal:G/A revive:-/F',
  construction: 'atk_spd:B/E atk_pow:Y/S crit:Y/F max_hp:B/B temp_hp:B/F toughness:B/C deflect:-/F heal:B/C revive:B/S dash:B taunt:B/D clv_down:R/C stun:R/S',
  dentist: 'atk_spd:G/D atk_pow:-/S crit:B/F max_hp:-/D temp_hp:G/D toughness:G/D deflect:-/F heal:G/D regen:G/A revive:-/F run_spd:G/F',
  electrician: 'atk_spd:G/E atk_pow:B/S cleave:B/F max_hp:B/C evasion:G/F toughness:-/D deflect:-/F revive:B/S run_spd:B/E',
  farmer: 'atk_spd:-/F atk_pow:B/S cleave:B/S max_hp:B/B temp_hp:B/F toughness:B/S deflect:-/F heal:Y/D regen:G/D heal_recv:D revive:B/S taunt:B/S',
  finance: 'atk_spd:-/F atk_pow:G/S cleave:G/F max_hp:G/C evasion:B/D toughness:-/D deflect:B/D revive:B/S run_spd:G/F',
  manager: 'atk_spd:Y/E atk_pow:-/S crit:Y/F max_hp:G/S toughness:-/D deflect:G/E heal:G/F revive:B/S',

  'family:fantasy': 'crit:G/F temp_hp:G/F evasion:G/E deflect:G/S revive:G/F',
  bard: 'atk_spd:B/E atk_pow:G/F crit:-/F max_hp:B/D temp_hp:B/F evasion:G/C toughness:G/F deflect:-/S revive:-/F run_spd:G/F',
  cleric: 'atk_spd:D atk_pow:B/F multihit:G/D crit:-/F temp_hp:G/D evasion:G/D toughness:B/F deflect:-/S heal:G/A heal_recv:G/S revive:B/S',
  druid: 'atk_spd:D atk_pow:G/S cleave:B/C multihit:B/S crit:B/D lifesteal:B/C temp_hp:B/E evasion:-/E toughness:G/F deflect:-/S revive:B/S dash:B',
  paladin: 'atk_pow:G/S crit:-/F max_hp:B/B temp_hp:-/F evasion:-/E toughness:Y/F deflect:-/S heal:B/F heal_recv:B/D revive:B/S run_spd:Y/F stun:R',
  ranger: 'atk_spd:D atk_pow:G/S crit:B/S max_hp:B/D temp_hp:-/F evasion:G/D deflect:-/S revive:-/F vuln:R/D',
  warlock: 'atk_spd:B/F atk_pow:B/S crit:G/E lifesteal:B/S max_hp:B/D temp_hp:-/F evasion:-/E deflect:-/S revive:-/F taunt:B/S',
  wizard: 'atk_spd:D atk_pow:G/F crit:B/S crit_dmg:B/E temp_hp:B/D evasion:-/E deflect:-/S revive:B/S run_spd:D',

  'family:scifi': 'atk_spd:G/F temp_hp:G/F toughness:G/F deflect:G/D regen:G/F revive:G/E',
  alien: 'atk_spd:D/F atk_pow:Y/E crit:Y/E max_hp:B/C temp_hp:Y/E toughness:-/F deflect:G/S regen:B/D revive:Y/D dash:Y',
  cyborg: 'atk_spd:D/F atk_pow:B/S multihit:B/C crit:G/F max_hp:B/C temp_hp:-/F toughness:B/F deflect:G/S regen:-/F revive:B/S run_spd:B/E',
  mutant: 'atk_spd:B/D atk_pow:G/S cleave:G/F temp_hp:-/F toughness:G/F deflect:-/D heal:G/S regen:B/D heal_recv:G/E revive:-/E dash:B',
  psionic: 'atk_spd:-/F max_hp:B/C temp_hp:B/E toughness:B/F deflect:G/S regen:-/F revive:-/E taunt:B/D atk_down:R/C vuln:R/E',
  quantum: 'atk_spd:D/F max_hp:B/C temp_hp:G/D evasion:G/E toughness:-/F deflect:G/C heal:G/B regen:B/C revive:G/C summon:B/S run_spd:D',
  time: 'atk_spd:Y/S max_hp:B/C temp_hp:-/F toughness:G/E deflect:-/D regen:-/F revive:B/S run_spd:Y/F',
  trooper: 'atk_spd:G/E atk_pow:G/F crit:G/F max_hp:B/D temp_hp:-/F toughness:B/S deflect:-/D regen:-/F revive:B/S',

  'family:sports': 'atk_pow:G/E crit:G/F temp_hp:G/F heal:G/F regen:G/F run_spd:G/E miss:R/C crit_exp:R/S vuln:R/E',
  basketball: 'atk_spd:D atk_pow:B/B multihit:G/D crit:G/F max_hp:B/C temp_hp:-/F evasion:G/F heal:-/F regen:-/F run_spd:-/E miss:R/S crit_exp:-/S vuln:R/S',
  broadcaster: 'atk_pow:Y/S cleave:G/A crit:Y/D max_hp:B/C temp_hp:G/F block:B/D toughness:G/F heal:-/F regen:-/F run_spd:-/E miss:R/S crit_exp:-/S vuln:R/D',
  coach: 'atk_spd:B/F atk_pow:-/E multihit:G/D crit:-/F max_hp:G/C temp_hp:G/D block:G/E deflect:B/E heal:G/D regen:G/S revive:Y/C run_spd:G/D miss:-/C crit_exp:-/S vuln:-/E',
  football: 'atk_pow:G/S crit:-/F max_hp:B/C temp_hp:-/F block:G/D toughness:G/F heal:-/F regen:G/E revive:B/S dash:G run_spd:-/E miss:-/C crit_exp:-/S vuln:R/C',
  hockey: 'atk_pow:G/D crit:G/F max_hp:B/B temp_hp:-/F block:B/S deflect:G/F heal:-/F regen:-/F run_spd:G/D taunt:B/E miss:-/C crit_exp:-/S vuln:-/E',
  soccer: 'atk_spd:B/S atk_pow:B/S crit:-/F temp_hp:-/F evasion:B/F block:G/D toughness:B/F heal:-/F regen:-/F revive:B/S run_spd:B/D miss:-/C crit_exp:-/S vuln:-/E',
  tennis: 'atk_spd:D atk_pow:B/C cleave:B/F crit:B/F crit_dmg:B/S max_hp:B/D temp_hp:-/F evasion:B/D toughness:B/F heal:-/F regen:-/F run_spd:-/E miss:R/S crit_exp:-/S vuln:-/E',
  nude: 'atk_pow:-/E crit:-/F max_hp:D temp_hp:-/F heal:-/F regen:-/F run_spd:D/E miss:-/C crit_exp:-/S vuln:-/E',

  'group:universal': 'atk_spd:G/A atk_pow:G/D cleave:G/E crit:G/F max_hp:G/S temp_hp:G/F toughness:G/F heal:G/F heal_recv:G/S revive:G/F summon:G/S run_spd:G/F taunt:G/D vuln:R/S stun:R',
  'group:promoter': 'atk_pow:G/F cleave:G/F crit:G/F crit_dmg:G/S lifesteal:G/D evasion:G/F block:G/F deflect:G/F heal:G/F regen:G/F miss:R/E',
  basic: 'atk_pow:B/F max_hp:B/S',
};

/** Strength grade from the spreadsheet: the stacked total vs the best in that column. */
export type ChartGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const GRADE_LABELS: Record<ChartGrade, string> = {
  S: 'best in the chart, or within 5% of it (or uncapped stacking)',
  A: '85–95% of the best',
  B: '70–85% of the best',
  C: '50–70% of the best',
  D: '30–50% of the best',
  E: '20–30% of the best',
  F: 'under 20% of the best',
};

/** Best stacked total per column, the reference each grade is measured against. */
export const COLUMN_BEST: Record<string, string> = {
  atk_spd: '115% (Time)', atk_pow: '400% (Broadcaster)', cleave: '400% (Farmer)', multihit: '50% (Druid)',
  crit: '85% (General)', crit_dmg: '220% (Pirate)', lifesteal: '15% (Warlock)', max_hp: '60% (Universal Relics)',
  temp_hp: '53.3 HP/s (Knight)', evasion: '90% (Pirate)', block: '55% (Hockey)', toughness: '225% (Farmer)',
  deflect: '100% (Wizard)', heal: '51 HP/s (Medic)', regen: '17% (Franken)', heal_recv: '100% (Universal Relics)',
  revive: '100% (Wizard)', summon: '3 summons (Quantum)', run_spd: '750% (Medic)', taunt: '11 enemies (Warlock)',
  miss: '20% (Tennis)', crit_exp: '10% (Tennis)', clv_down: '15% (Zombie)', atk_down: '20% (Assassin)',
  vuln: '50% (Universal Relics)', stun: '1 s (Construction)',
};

interface Row {
  cells: Map<string, Cell>;
  grades: Map<string, ChartGrade>;
  /** Columns graded only through the Family's Relics (no colour of his own). */
  familyOnly: Set<string>;
}

/** "col:Cell/Grade" pairs; the grade is optional, and Cell "-" means the grade comes only from Family Relics. */
function parse(row: string): Row {
  const out: Row = { cells: new Map(), grades: new Map(), familyOnly: new Set() };
  for (const pair of row.split(' ').filter(Boolean)) {
    const [col, rest] = pair.split(':');
    const [cell, grade] = rest.split('/');
    if (cell === '-') out.familyOnly.add(col);
    else out.cells.set(col, cell as Cell);
    if (grade) out.grades.set(col, grade as ChartGrade);
  }
  return out;
}

const rows = new Map(Object.entries(ROWS).map(([k, v]) => [k, parse(v)]));
const parsed = new Map([...rows].map(([k, v]) => [k, v.cells]));

/** Dude ids that have a chart row, in chart order (grouped by Family). */
export const CHART_DUDES = [...parsed.keys()].filter((k) => !k.includes(':') && k !== 'basic');

/** Rows for Relics outside the Families: Universal (any Dude) and Promoter. */
export const GROUP_ROWS = [
  { id: 'universal', name: 'Universal Relics' },
  { id: 'promoter', name: 'Promoter Relics' },
];
export const groupCells = (id: string) => parsed.get(`group:${id}`);

/** Cells for a Dude id, or undefined if the chart has no row for him (summons). Regular Dude (basic) has a row. */
export const dudeCells = (dudeId: string) => parsed.get(dudeId);
export const familyCells = (familyId: string) => parsed.get(`family:${familyId}`);
export const cellOf = (dudeId: string, col: string) => parsed.get(dudeId)?.get(col);
export const inChart = (dudeId: string) => parsed.has(dudeId);

/** Strength grade of a row's cell ("family:x" and "group:x" keys work too). */
export const gradeOf = (key: string, col: string) => rows.get(key)?.grades.get(col);
/** True when the grade comes only from the Family's Relics (grey letter, no colour). */
export const familyOnly = (key: string, col: string) => rows.get(key)?.familyOnly.has(col) ?? false;

const GRADE_WEIGHT: Record<ChartGrade, number> = { S: 1.5, A: 1.35, B: 1.2, C: 1, D: 0.85, E: 0.7, F: 0.55 };
/** Multiplier for a cell's strength: 1 when ungraded (dark blue, Dash). */
export const gradeWeight = (key: string, col: string) => {
  const g = gradeOf(key, col);
  return g ? GRADE_WEIGHT[g] : 1;
};

export const givesToTeam = (c: Cell | undefined) => c === 'G' || c === 'Y';
export const scales = (c: Cell | undefined) => c === 'B' || c === 'D';

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
