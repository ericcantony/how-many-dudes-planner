import raw from './game.json';

/** A description is a list of tokens: plain text, a variable (number/name), or a glossary term. */
export type Token = [kind: 't' | 'v' | 'g', text: string];

export interface Family {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export interface Dude {
  id: string;
  name: string;
  icon: string;
  sprite: string;
  family: string | null;
  /** Display text, e.g. "130" or "10%". Use statNum() for maths. */
  stats: Record<string, string>;
  ability: { name: string; desc: Token[] };
  relics: string[];
  /** Summoned by another Dude, not recruited directly. */
  summon: boolean;
}

export interface Relic {
  id: string;
  name: string;
  icon: string;
  desc: Token[];
  scope: 'global' | 'family' | 'dude';
  family?: string;
  dudes?: string[];
}

export interface Trinket {
  id: string;
  name: string;
  icon: string;
  desc: Token[];
}

interface RawData {
  source: string;
  scrapedAt: string;
  families: Family[];
  dudes: Omit<Dude, 'summon'>[];
  relics: Relic[];
  trinkets: Trinket[];
}

const data = raw as unknown as RawData;

/** Dudes that only appear as summons (no ability of their own). */
const SUMMONS = new Set(['echo', 'skeleton']);

export const SOURCE = data.source;
export const SCRAPED_AT = data.scrapedAt;
export const families = data.families;
export const dudes: Dude[] = data.dudes.map((d) => ({ ...d, summon: SUMMONS.has(d.id) }));
export const relics = data.relics;
export const trinkets = data.trinkets;

export const familyById = new Map(families.map((f) => [f.id, f]));
export const dudeById = new Map(dudes.map((d) => [d.id, d]));
export const relicById = new Map(relics.map((r) => [r.id, r]));
export const trinketById = new Map(trinkets.map((t) => [t.id, t]));

export const sprite = (id: string) => `${import.meta.env.BASE_URL}sprites/${id}_0.webp`;
export const wikiUrl = (slug: string) => `https://howmanydudes.com/en/dudex/${slug}`;
export const statNum = (d: Dude, key: string) => Number.parseFloat((d.stats[key] ?? '0').replaceAll(',', '')) || 0;
export const tokensText =(t: Token[]) => t.map((x) => x[1]).join('');

export const STAT_LABELS: Record<string, string> = {
  hpmax: 'Max HP',
  dps: 'DPS',
  damage: 'Attack Power',
  attack_speed: 'Attack Speed',
  speed: 'Run Speed',
  deflection: 'Deflection',
  evasion: 'Evasion',
  toughness: 'Toughness',
  crit_chance: 'Crit Chance',
  block_chance: 'Block Chance',
  cleave: 'Cleave',
  regeneration: 'Regeneration',
  lifesteal: 'Lifesteal',
};
