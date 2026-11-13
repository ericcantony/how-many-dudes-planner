# How Many Dudes? Comp Planner

Live site: https://how-many-dudes-planner.vercel.app (after deploying to Vercel)

Fan-made, not affiliated with Butterscotch Shenanigans. Synergy chart by u/esmgcito ([original post](https://www.reddit.com/r/HowManyDudes/comments/1xpsy6l/dude_classes_are_difficult_to_remember/)). Found a wrong chart cell or a missing synergy? [Open an issue](https://github.com/MuhEricCantonaBudiamin/how-many-dudes-planner/issues).

A team-composition planner for *How Many Dudes?*. Build an ordered Roster of Dude Types, see which position-based abilities link up, check Family and count-based synergies, and plan Relics and Trinkets. Comps save in the browser and share as a link.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## Game data

`src/data/game.json` and `public/sprites/` are scraped from the official Dudex (https://howmanydudes.com/en/dudex). To refresh after a game update:

```sh
rm -rf scripts/.cache   # cached HTML; delete it to fetch fresh pages
npm run scrape
```

## Where things live

- `scripts/scrape.mjs`: Dudex scraper (Dudes, Families, Relics, Trinkets, sprites)
- `src/lib/synergy.ts`: synergy rules. Position links (`POSITIONAL`), count-based notes, team Relic payoffs and roles. Add new rules here when the game adds Dudes or Relics that care about Roster order or counts.
- `src/data/chart.ts`: the synergy chart by u/esmgcito ([original post](https://www.reddit.com/r/HowManyDudes/comments/1xpsy6l/dude_classes_are_difficult_to_remember/)), one row per Dude and Family (`ninja: 'atk_spd:G atk_pow:D …'`). Letters: G gives to any Dude Type, Y gives to other types, B gives only to himself, D scales with it, R affects enemies. Fix a cell by editing its row. Relics that give stats are detected from "gains X% Stat" in their text.
- `src/lib/comp.ts`: comp model, share-link encoding and localStorage
- `src/components/`: picker, roster (drag-and-drop with link wires), breakdown panel, item picker
