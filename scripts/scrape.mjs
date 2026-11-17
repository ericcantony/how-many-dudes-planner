// One-off scraper: pulls Dudex data from howmanydudes.com into src/data/game.json
// and downloads sprites into public/sprites. Re-run with `npm run scrape`.
// Raw HTML is cached in scripts/.cache so re-runs don't re-hit the site.
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://howmanydudes.com';
const CACHE = path.join(ROOT, 'scripts', '.cache');
const SPRITES = path.join(ROOT, 'public', 'sprites');
const OUT = path.join(ROOT, 'src', 'data', 'game.json');
const UA = 'Mozilla/5.0 (compatible; hmd-comp-planner/1.0)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(slug) {
  const file = path.join(CACHE, `${slug}.html`);
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    /* not cached */
  }
  await sleep(250);
  const res = await fetch(`${BASE}/en/dudex/${slug}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  const html = await res.text();
  await fs.writeFile(file, html);
  return html;
}

/** Turn a description <p> into tokens: plain text, variables (numbers/names) and glossary terms. */
function tokens($, el) {
  const out = [];
  const push = (kind, text) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (kind === 't' && last && last[0] === 't') last[1] += text;
    else out.push([kind, text]);
  };
  const walk = (node) => {
    $(node)
      .contents()
      .each((_, c) => {
        if (c.type === 'text') push('t', c.data);
        else if (c.type === 'tag') {
          const cls = c.attribs.class || '';
          if (/\bvariable\b/.test(cls)) push('v', $(c).text());
          else if (/\bglossary-term\b/.test(cls)) push('g', $(c).text());
          else walk(c);
        }
      });
  };
  walk(el);
  for (const t of out) t[1] = t[1].replace(/\s+/g, ' ');
  if (out.length) {
    out[0][1] = out[0][1].trimStart();
    out[out.length - 1][1] = out[out.length - 1][1].trimEnd();
  }
  return out.filter((t) => t[1]);
}

/** Parse every <article> item in a Dudex item list. */
function parseItems($, scope) {
  const items = [];
  $(scope)
    .find('article')
    .each((_, a) => {
      const $a = $(a);
      const link = $a.find('p.name a').first();
      const slug = (link.attr('href') || '').split('/').pop();
      const img = $a.find('img').first();
      const desc = $a.find('p.description').first();
      const abilityName = $a.find('.ability_name').text().trim();
      const abilityDesc = desc.find('.ability_description');
      items.push({
        slug,
        name: link.text().trim(),
        sprite: img.attr('data-sprite-id'),
        abilityName: abilityName || undefined,
        desc: tokens($, abilityDesc.length ? abilityDesc : desc),
      });
    });
  return items;
}

const sprites = new Set();

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  await fs.mkdir(SPRITES, { recursive: true });
  await fs.mkdir(path.dirname(OUT), { recursive: true });

  // Families
  let $ = cheerio.load(await fetchPage('family'));
  const families = parseItems($, '#page-content').map((f) => {
    sprites.add(f.sprite);
    return { id: f.slug, name: f.name, icon: f.sprite, desc: f.desc.map((t) => t[1]).join('') };
  });
  console.log(`families: ${families.length}`);

  // Stats
  $ = cheerio.load(await fetchPage('stat'));
  const stats = parseItems($, '#page-content').map((s) => {
    sprites.add(s.sprite);
    return { id: s.slug, name: s.name, icon: s.sprite, desc: s.desc };
  });
  console.log(`stats: ${stats.length}`);

  // Relic catalogue
  $ = cheerio.load(await fetchPage('relic'));
  const relicList = parseItems($, '#page-content');
  const relics = {};
  for (const r of relicList) {
    sprites.add(r.sprite);
    relics[r.slug] = { id: r.slug, name: r.name, icon: r.sprite, desc: r.desc, scope: 'global' };
  }
  console.log(`relics: ${relicList.length}`);

  // Trinkets
  $ = cheerio.load(await fetchPage('trinket'));
  const trinkets = parseItems($, '#page-content').map((t) => {
    sprites.add(t.sprite);
    return { id: t.slug, name: t.name, icon: t.sprite, desc: t.desc };
  });
  console.log(`trinkets: ${trinkets.length}`);

  // Food (the Chef's meals): the list has no text, each page names the Primary Stat.
  // The second stat is random and the Dudex gives no amounts.
  $ = cheerio.load(await fetchPage('food'));
  const food = [];
  for (const f of parseItems($, '#page-content')) {
    const $f = cheerio.load(await fetchPage(f.slug));
    const label = $f('section.tooltip .label').filter((_, el) => $f(el).text().trim() === 'Primary Stat:');
    const primary = label.first().next().text().trim();
    sprites.add(f.sprite);
    food.push({ id: f.slug, name: f.name, icon: f.sprite, primary });
  }
  console.log(`food: ${food.length}`);

  // Dudes (list, then each page)
  $ = cheerio.load(await fetchPage('dude'));
  const dudeList = parseItems($, '#page-content');
  const dudes = [];
  for (const d of dudeList) {
    const $d = cheerio.load(await fetchPage(d.slug));
    const famSlug = ($d('#feature h2 a').attr('href') || '').split('/').pop();
    const family = families.some((f) => f.id === famSlug) ? famSlug : null;
    const stats = {};
    $d('#stats li.stat').each((_, li) => {
      const key = ($d(li).find('a').attr('href') || '').split('/').pop();
      // Keep the display text: some stats are percentages ("10%").
      stats[key] = $d(li).find('.value').text().trim();
    });
    const fullSprite = $d('#feature img').attr('data-sprite-id') || ($d('#feature img').attr('src') || '').match(/sprites\/(.+)_0\.webp/)?.[1];
    const abilityEl = $d('#ability');
    const ability = {
      name: abilityEl.find('h2').first().text().trim() || d.abilityName || '',
      desc: abilityEl.length ? tokens($d, abilityEl.find('p').first()) : d.desc,
    };
    // Relic groups: first group is the dude's own relics, a group whose header links to the family page holds family relics.
    const ownRelics = [];
    $d('#relics > section').each((_, sec) => {
      const headHref = $d(sec).find('header h3 a').attr('href') || '';
      const groupSlugs = parseItems($d, sec).map((r) => r.slug);
      const isFamily = family && headHref.endsWith(`/${family}`);
      for (const s of groupSlugs) {
        if (!relics[s]) continue;
        if (isFamily) {
          relics[s].scope = 'family';
          relics[s].family = family;
        } else {
          relics[s].scope = 'dude';
          relics[s].dudes ??= [];
          if (!relics[s].dudes.includes(d.slug)) relics[s].dudes.push(d.slug);
          ownRelics.push(s);
        }
      }
    });
    sprites.add(d.sprite);
    if (fullSprite) sprites.add(fullSprite);
    dudes.push({
      id: d.slug,
      name: d.name,
      icon: d.sprite,
      sprite: fullSprite || d.sprite,
      family,
      stats,
      ability,
      relics: ownRelics,
    });
  }
  console.log(`dudes: ${dudes.length}`);

  const data = {
    source: `${BASE}/en/dudex`,
    scrapedAt: new Date().toISOString().slice(0, 10),
    families,
    stats,
    dudes,
    relics: Object.values(relics),
    trinkets,
    food,
  };
  await fs.writeFile(OUT, JSON.stringify(data));
  console.log(`wrote ${path.relative(ROOT, OUT)}`);

  // Sprites (4 at a time, skip existing)
  const list = [...sprites].filter(Boolean);
  let done = 0;
  let failed = 0;
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const id = queue.shift();
        const file = path.join(SPRITES, `${id}_0.webp`);
        try {
          await fs.access(file);
        } catch {
          const res = await fetch(`${BASE}/sprites/${id}_0.webp`, { headers: { 'User-Agent': UA } });
          if (res.ok) await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
          else failed++;
          await sleep(100);
        }
        done++;
      }
    }),
  );
  console.log(`sprites: ${done} (failed ${failed})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
