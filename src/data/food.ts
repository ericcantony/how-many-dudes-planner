import { columnById } from './chart';
import { foods, type Token } from './game';

/**
 * Meal amounts. The Dudex only names each meal's Primary Stat, so the numbers come from a player's
 * Steam guide ("A Reference Guide To All Dudes, Relics, Trinkets & More" by Joanne Fairchild,
 * updated 2026-11-08), and match a Red Curry the user got in game (20% Attack Speed + 5% Crit Chance).
 * Players report wrong numbers; fix them here.
 */

export interface FoodStat {
  /** Chart column. */
  col: string;
  /** Stat key in stats.ts. */
  stat: string;
  value: number;
}

const stat = (col: string, statKey: string, value: number): FoodStat => ({ col, stat: statKey, value });

/** The fixed first stat of each meal. */
export const FOOD_FIRST: Record<string, FoodStat> = {
  ft_baguette: stat('evasion', 'evasion', 10),
  ft_chili_dog: stat('max_hp', 'hpmax', 20),
  ft_hot_pot: stat('atk_pow', 'damage', 20),
  ft_naan: stat('cleave', 'cleave', 50),
  ft_pretzel: stat('crit', 'crit_chance', 10),
  ft_ramen: stat('deflect', 'deflection', 10),
  ft_red_curry: stat('atk_spd', 'attack_speed', 20),
  ft_taco: stat('toughness', 'toughness', 10),
};

/** The random second stat: one of these, at this amount. */
export const FOOD_SECOND: FoodStat[] = [
  stat('atk_pow', 'damage', 10),
  stat('atk_spd', 'attack_speed', 10),
  stat('block', 'block_chance', 5),
  stat('cleave', 'cleave', 25),
  stat('crit', 'crit_chance', 5),
  stat('crit_dmg', 'crit_damage', 15),
  stat('deflect', 'deflection', 5),
  stat('evasion', 'evasion', 5),
  stat('heal_recv', 'healing_surge', 5),
  stat('max_hp', 'hpmax', 10),
  stat('run_spd', 'speed', 20),
  stat('toughness', 'toughness', 5),
];
export const foodSecondByCol = new Map(FOOD_SECOND.map((s) => [s.col, s]));

/** Rarely a meal has no second stat; then its first stat is 1.5× (seen once: Ramen gave 15% Deflection). */
export const NO_SECOND = 'none';
const NO_SECOND_FACTOR = 1.5;

/** Valid values for an entry's `foodSecond`. */
export const SECOND_CHOICES = new Set([...FOOD_SECOND.map((s) => s.col), NO_SECOND]);

const labelOf = (col: string) => columnById.get(col)?.label ?? col;

/**
 * What a meal gives, given its second stat (null = not known yet, so only the first stat counts).
 * The same stat twice shows as one bigger number, as the Dudex says.
 */
export function foodStats(foodId: string, second: string | null): FoodStat[] {
  const first = FOOD_FIRST[foodId];
  if (!first) return [];
  if (second === NO_SECOND) return [{ ...first, value: first.value * NO_SECOND_FACTOR }];
  const extra = second ? foodSecondByCol.get(second) : undefined;
  if (!extra) return [first];
  if (extra.col === first.col) return [{ ...first, value: first.value + extra.value }];
  return [first, extra];
}

/** "20% Attack Speed and 5% Crit Chance". */
export const foodText = (stats: FoodStat[]) => stats.map((s) => `${s.value}% ${labelOf(s.col)}`).join(' and ');

/** Second-stat option label, e.g. "5% Crit Chance", or the no-second case. */
export const secondLabel = (foodId: string, col: string) => {
  if (col === NO_SECOND) {
    const first = FOOD_FIRST[foodId];
    return first ? `None (first stat ${first.value * NO_SECOND_FACTOR}%)` : 'None';
  }
  const s = foodSecondByCol.get(col);
  return s ? `${s.value}% ${labelOf(col)}` : labelOf(col);
};

/** Food id → the stat it always gives (for the picker's stat filter). */
export const FOOD_GIVES = new Map(Object.entries(FOOD_FIRST).map(([id, s]) => [id, [s.col]]));

/** Meals for pickers, with text that names the amounts. */
export const FOOD_ITEMS = foods.map((f) => {
  const first = FOOD_FIRST[f.id];
  const desc: Token[] = [
    ['t', 'Always gives '],
    ['v', first ? `${first.value}%` : ''],
    ['t', ' '],
    ['g', f.primary],
    ['t', ', plus usually a random second stat. One Dude Type eats it, like a Trinket.'],
  ];
  return { id: f.id, name: f.name, icon: f.icon, desc: desc.filter((t) => t[1]) };
});
export const foodItemById = new Map(FOOD_ITEMS.map((f) => [f.id, f]));
