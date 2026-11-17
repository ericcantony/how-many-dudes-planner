/**
 * Version and changelog.
 *
 * Version = `<game version>.<our major>.<our minor>`, e.g. 1.1.1.20: How Many Dudes? 1.1, planner major 1, release 20.
 * Every push to main is a release: add an entry at the TOP of CHANGELOG (next minor) in the same commit.
 * When the game updates (e.g. to 1.2), change GAME_VERSION and start minors again at 1 for the new game version.
 */
export const GAME_VERSION = '1.1';
export const APP_MAJOR = 1;

export interface Release {
  /** Our minor version: the last number of the full version. */
  minor: number;
  /** YYYY-MM-DD. */
  date: string;
  /** Short commit hash of the release, or '' for the release being prepared. */
  commit: string;
  title: string;
  items: string[];
}

/** Newest first. */
export const CHANGELOG: Release[] = [
  {
    minor: 22,
    date: '2026-11-17',
    commit: '',
    title: 'Trinket and Food stash',
    items: [
      'New Trinket stash under Your Relics: enter the 3 Trinkets the game offers, and each is graded ++ / + / 0 / − like the Relic stash.',
      'Each Trinket is tried on every Dude Type of your Roster, and the card says who should hold it (“Best on Tennis Dude”). Pick another holder from the list if you like.',
      '“Give to X” puts it in that Dude Type’s Trinket slot, replacing his old one (the grade counts what he loses).',
      'The Trinket picker can filter by stat, like the Relic picker.',
      'Food stash: grades the 3 meals the game offers the same way, and each Roster row gets a meal slot next to the Trinket.',
      'Meals count in the Roster stats and Team HP/DPS. Each meal has a fixed first stat (Red Curry: 20% Attack Speed) and a random second one you pick when you see it (e.g. 5% Crit Chance).',
      'The Dudex lists no meal amounts, so they come from a player’s Steam guide. Tell us if a meal shows different numbers in your game.',
      'Crit Damage now counts: a crit deals the hit + 100% + your Crit Damage (10 → 20, or 25 with 50% Crit Damage). Arsenal, Arcane Monocle and other Crit Damage Relics, Trinkets and meals grade better, most on high-crit Dudes. Roster rows show Crit Damage when something gives it.',
      'Breakdown shows “Effective” Team HP and DPS under the plain totals: HP after Toughness, Evasion, Block and Deflection, DPS with Crits and Cleave. Hover for how they’re worked out; the stash grades use these.',
      'Multistrike counts: shown on Roster rows when something gives it, and added to effective DPS like Cleave (every 100% is one extra hit). Team Jersey and Tall Socks now count in the stats.',
    ],
  },
  {
    minor: 21,
    date: '2026-11-16',
    commit: '225b97f',
    title: 'Clearer “build around your first Dude”',
    items: [
      'Adding your first Dude always sets the focus stats to his strongest ones, even if old focus stats were left over from an earlier comp.',
      'If that replaced stats you had, “Undo” in Build around brings them back.',
      'A message confirms the change, e.g. “Building around Psionic Dude: focus set to Max HP, Deflection, Toughness”.',
    ],
  },
  {
    minor: 20,
    date: '2026-11-16',
    commit: 'a64c408',
    title: 'Version number and changelog',
    items: [
      'The version shows in the header; click it for this changelog.',
      'The changelog also shows which build is live, so you can tell whether a change has reached the site.',
    ],
  },
  {
    minor: 19,
    date: '2026-11-16',
    commit: '0f3a9d7',
    title: 'Build around a Dude',
    items: [
      'Adding your first Dude sets your focus stats to his strongest ones (Psionic: Max HP, Deflection, Toughness), and Fill your team suggests the rest.',
      '“Build around X” button in each Roster row’s details and in the Recruit info card.',
      'Never overwrites focus stats you picked yourself.',
    ],
  },
  {
    minor: 18,
    date: '2026-11-14',
    commit: '204a7ff',
    title: 'Healers, targets in the Roster, tidier rows',
    items: [
      'A Dude counts as a healer only if his ability heals, or one of his healing Relics is in Your Relics (General needs Frilled Shoulderpads). Otherwise you see “would heal with X”.',
      'The Recruit plan moved into the Roster: each row has an editable “Aim for N%” target, and the header holds “Expecting N Dudes”.',
      'Round pick, training event and “got Regulars” helpers removed.',
      'The Run card hides once every flyer is used.',
      'Family label sits beside the Dude’s name; the small target bar is gone.',
    ],
  },
  {
    minor: 17,
    date: '2026-11-14',
    commit: '143ef2d',
    title: 'Roster first, Your Relics card',
    items: [
      'The Roster leads the Planner; run tracking and Relic stash follow.',
      'New “Your Relics” card under Relic stash, with Team Relic payoffs (Bonfire, Championship Belt, Sensitivity Training).',
      'No more “plan / planned” wording for Relics.',
    ],
  },
  {
    minor: 16,
    date: '2026-11-14',
    commit: '193de96',
    title: 'Code cleanup',
    items: ['Behind-the-scenes cleanup of the synergy analysis. No visible change.'],
  },
  {
    minor: 15,
    date: '2026-11-14',
    commit: '9ba5adf',
    title: 'Fill your team, our own grades',
    items: [
      'Fill your team: ranked teammates for your open slots across all focus stats, with reasons.',
      '“Also from”: the best Dude givers show even when your Family already covers a stat.',
      'Grades (S–F) are now estimated from the Dudex Relic and ability text: what a Dude gives teammates vs himself. Healing is graded in HP per second.',
      'Healers ranked by HP/s; HP transfers (Blood Pump) count half.',
      'Hover a suggestion to see the Relics and numbers behind it.',
    ],
  },
  {
    minor: 14,
    date: '2026-11-14',
    commit: '7140273',
    title: 'Synergy chart update',
    items: ['Chart colours updated from the chart author’s spreadsheet (14 cells, each checked against the Dudex).'],
  },
  {
    minor: 13,
    date: '2026-11-14',
    commit: '3da3d9c',
    title: 'Smarter Relic grades',
    items: [
      'Family Relics count as whole-team.',
      'Position Relics (Captain’s Hat, Caboose, Black Sheep, Lieutenant’s Sigil, Assistant Coach) only buff their Roster slot.',
      'Jaw Implant is graded down without a summoner.',
      'Always-on stats count even when the Relic text goes on to a timed effect.',
    ],
  },
  {
    minor: 12,
    date: '2026-11-14',
    commit: '8acc7c1',
    title: 'Relic grades: reliable triggers',
    items: [
      'Relics that fire off a timed ability (Imposing Podium, Combat Radio, UFO Wax…) count toward the stats.',
      'Grades measure effective survivability and damage (Toughness, Evasion, Block, Crit, Cleave), not just HP and DPS.',
    ],
  },
  {
    minor: 11,
    date: '2026-11-14',
    commit: '4c26f37',
    title: 'Relic stash helper',
    items: [
      'Enter the 3 Relics the game offers; each is graded ++ / + / 0 / − for your team.',
      'DPS tooltip shows Attack Power × Attack Speed.',
    ],
  },
  {
    minor: 10,
    date: '2026-11-13',
    commit: '14bee3c',
    title: 'Code cleanup',
    items: ['Behind-the-scenes cleanup. No visible change.'],
  },
  {
    minor: 9,
    date: '2026-11-13',
    commit: 'a684d1f',
    title: 'Better tooltips',
    items: ['Stat chips use styled tooltips that stay visible above scrolling panels.'],
  },
  {
    minor: 8,
    date: '2026-11-13',
    commit: '3d6d1bb',
    title: 'Legal notes',
    items: ['Footer links to Butterscotch Shenanigans’ Terms of Service and IP policy.'],
  },
  {
    minor: 7,
    date: '2026-11-13',
    commit: 'c1b39dc',
    title: 'Repo links',
    items: ['Source code links point to the GitHub repo.'],
  },
  {
    minor: 6,
    date: '2026-11-13',
    commit: '641fd94',
    title: 'Recruit plan and stat panels',
    items: [
      'Target share per Dude Type, with custom targets.',
      'Roster rows show game-style stats, including buffs from Relics, Trinkets and the Roster.',
    ],
  },
  {
    minor: 5,
    date: '2026-11-13',
    commit: 'f88a6b6',
    title: 'Run tracking',
    items: [
      'Track a run: enter each flyer’s 3 options and get a grade for each.',
      'Ensemble mode; the Roster holds Regular Dude plus 5 other types.',
    ],
  },
  {
    minor: 4,
    date: '2026-11-13',
    commit: 'c28d05f',
    title: 'README',
    items: ['README links the live site.'],
  },
  {
    minor: 3,
    date: '2026-11-13',
    commit: '0e3782a',
    title: 'Footer link',
    items: ['Footer links the GitHub repo.'],
  },
  {
    minor: 2,
    date: '2026-11-13',
    commit: '841aca4',
    title: 'Chart credit',
    items: ['Credit u/esmgcito for the synergy chart.'],
  },
  {
    minor: 1,
    date: '2026-11-13',
    commit: '3267033',
    title: 'First release',
    items: [
      'Roster builder with position links, Family and count synergies.',
      'Relic and Trinket planning, the community synergy chart, saving and share links.',
    ],
  },
];

export const versionOf = (r: Release) => `${GAME_VERSION}.${APP_MAJOR}.${r.minor}`;
export const APP_VERSION = versionOf(CHANGELOG[0]);
