// Estimates S–F strength grades for the synergy chart from Dudex Relic and ability text (src/data/game.json).
// For every Dude (his own Relics + ability), Family (its Relics) and the global Relics ("group:universal"), it adds up
// the percentage stats given to TEAMMATES and to HIMSELF, then grades each against the best Dude in its column.
// Output: src/data/grades.json. Run: npm run grades
//
// Model (an estimate, kept simple and explainable; every number lists its sources):
//   value × stacks × uptime × chance × reach, read from the stat's own CLAUSE (a sentence splits at ", and" + a new
//   subject, so "gains 20% Attack Power, and his Triage … for 5 seconds" keeps the 20% flat)
//   stacks  "stack(s/ing) up to N times" (this clause, or a next sentence like "These effects stack…");
//           "per / for each X Dude" right after the stat = 30 (assumed copies); "per unique Family" = 3;
//           "per stack" = 4; "up to N%" caps the value
//   uptime  "for D seconds" + "every P seconds" = min(1, D/P), also when it fires off an ability that runs every
//           P seconds (Divine Pulse, Tactical Command…; "every 2 times" doubles P); buffs granted by a status
//           use STATUS (Rum, Berserk…); "for D seconds" after another event = 0.5; battle start = D/30;
//           "for the rest of the battle" = 0.7; Fatal Damage triggers = 0.1; untimed = 1
//   chance  "N% chance" before the stat, in the same clause
//   reach   (teammates only) all Dudes = 1, nearby Dudes = 0.6, a few (N random/nearby, Asset, healed, the Dude
//           Type below, a named other Dude such as a summon…) = 0.4. Self = the owner by name, or he/him.
//   Grades compare Dude rows with Dude rows (best at least 5%); Family and Universal rows use the same scale.
// Healing ("heal", in HP per second) comes from the hand-extracted table in scripts/heal-sources.mjs; see below.
import { readFileSync, writeFileSync } from 'node:fs';

const game = JSON.parse(readFileSync(new URL('../src/data/game.json', import.meta.url), 'utf8'));

const TERM_TO_COL = {
  'Attack Speed': 'atk_spd',
  'Attack Power': 'atk_pow',
  Cleave: 'cleave',
  Multistrike: 'multihit',
  'Crit Chance': 'crit',
  'Crit Damage': 'crit_dmg',
  Lifesteal: 'lifesteal',
  'Max HP': 'max_hp',
  Evasion: 'evasion',
  'Block Chance': 'block',
  Toughness: 'toughness',
  Deflection: 'deflect',
  Regeneration: 'regen',
  'Healing Received': 'heal_recv',
  'Run Speed': 'run_spd',
};

const BATTLE_SECONDS = 30;
const COPIES = 30;
const PER_STACK = 4;
const UNIQUE_FAMILIES = 3;
/** Columns where even the best Dude gives very little are graded against at least this much. */
const MIN_BEST = 5;
const OTHERS_ALL = /\b(all|your) (roster )?dudes\b|\bteam\b|^\s*(the )?dudes\s*$/i;
const OTHERS_NEARBY = /\bnearby dudes\b/i;
// "A few Dudes" wording, split in two so each pattern stays simple.
const OTHERS_FEW = [
  /\b(dudes|roster dude|any dude|a dude|nearby dude|that dude|the dude|dude type)\b/i,
  /\b(host|assets?|interns?|thralls?|blessed|targets?|allies|healed|most-injured|mvp)\b/i,
];
const SELF_WORDS = /\b(he|him|himself|his own)\b/i;
const GRANT_VERB = /\b(gains?|gaining|gets?|grants?|granting)\b/gi;
const DUDE_NAMES = new Set(game.dudes.map((d) => d.name));
const nameOf = new Map(game.dudes.map((d) => [d.id, d.name]));

/** Ability name → seconds between uses ("Every 2 seconds, the Cleric Dude creates a Pulse…"). */
const ABILITY_PERIOD = new Map();
for (const d of game.dudes) {
  const m = /every (\d+(?:\.\d+)?) seconds?/i.exec((d.ability?.desc ?? []).map(([, t]) => t).join(''));
  if (m) ABILITY_PERIOD.set(d.ability.name, Number.parseFloat(m[1]));
}
// Quantum Echo summons every 5 s, but each Echo heals every second.
ABILITY_PERIOD.set('Quantum Echo', 1);

/** Statuses that grant stats while active ("Rum now grants 10% Crit Chance"): who holds them and their uptime. */
const STATUS = {
  Rum: { to: 'self', f: 0.6, why: 'Rum 3s every 5s' },
  Berserk: { to: 'self', f: 0.5, why: 'while Berserk 0.5' },
  'Bear Form': { to: 'self', f: 0.5, why: 'in Bear Form 0.5' },
  Revenant: { to: 'team', f: 1, why: 'on his Thralls' },
  Blessing: { to: 'team', f: 0.5, why: 'Blessing 0.5' },
  Burger: { to: 'team', f: 0.5, why: 'Burger 0.5' },
  Burgers: { to: 'team', f: 0.5, why: 'Burger 0.5' },
  Hype: { to: 'team', f: 0.5, why: 'Hype 0.5' },
  'Health Potions': { to: 'team', f: 0.5, why: 'potions 0.5' },
};

/** Relics whose reach the wording overstates. */
const REACH_OVERRIDES = {
  'Bass Drum': { f: 0.4, why: 'the 4 Dudes his Song inspires 0.4' }, // "inspires your Dudes", but the Song hits 4 random Dudes
};

const plain = (tokens) => tokens.map(([, t]) => t).join('');
const num = (s) => Number.parseFloat(s.replaceAll(',', ''));
const isPct = (tok) => tok?.[0] === 'v' && tok[1].endsWith('%');

/** Split a token list into sentences (a sentence ends at "." or "!" inside a text token). */
function sentences(desc) {
  const out = [[]];
  for (const [kind, text] of desc) {
    if (kind !== 't') {
      out.at(-1).push([kind, text]);
      continue;
    }
    let rest = text;
    let cut = rest.search(/[.!](\s|$)/);
    while (cut >= 0) {
      out.at(-1).push(['t', rest.slice(0, cut + 1)]);
      out.push([]);
      rest = rest.slice(cut + 1);
      cut = rest.search(/[.!](\s|$)/);
    }
    if (rest) out.at(-1).push(['t', rest]);
  }
  return out.filter((s) => s.length);
}

/** Split a sentence into clauses at ", and " / "; " followed by a new subject (not another "N% Stat" of a list). */
function clauses(sentence) {
  const out = [[]];
  sentence.forEach((tok, k) => {
    const [kind, text] = tok;
    const cut = kind === 't' ? text.search(/(, and |; )/) : -1;
    const listGoesOn = cut >= 0 && !text.slice(cut).replace(/^(, and |; )/, '').trim() && isPct(sentence[k + 1]);
    if (cut < 0 || listGoesOn) {
      out.at(-1).push(tok);
      return;
    }
    out.at(-1).push(['t', text.slice(0, cut)]);
    out.push([['t', text.slice(cut)]]);
  });
  return out;
}

function stacksOf(text, next, tail) {
  const m = /stack(?:s|ing)? up to (\d+) times/i.exec(text);
  if (m) return { n: num(m[1]), why: `${m[1]} stacks` };
  const later = /%/.test(next) ? null : /stack(?:s|ing)? up to (\d+) times/i.exec(next);
  if (later) return { n: num(later[1]), why: `${later[1]} stacks` };
  if (/^[^,.]*\bunique family\b/i.test(tail)) return { n: UNIQUE_FAMILIES, why: `${UNIQUE_FAMILIES} Families` };
  if (/^[^,.]*\b(per|for each|for every) [\w' ]*dude\b/i.test(tail)) return { n: COPIES, why: `${COPIES} copies` };
  if (/^[^,.]*\bper stack\b/i.test(tail)) return { n: PER_STACK, why: `${PER_STACK} stacks` };
  return { n: 1, why: '' };
}

function uptimeOf(text, tokens, status) {
  const dur = /for (\d+(?:\.\d+)?) seconds?/i.exec(text);
  const ability = tokens.find(([k, t]) => k === 'g' && ABILITY_PERIOD.has(t))?.[1];
  const times = /every (\d+) times/i.exec(text);
  if (/rest of the battle/i.test(text)) return { f: 0.7, why: 'rest of battle 0.7' };
  if (/fatal/i.test(text)) return { f: 0.1, why: 'on Fatal Damage 0.1' };
  if (dur && /battle starts/i.test(text)) {
    return { f: Math.min(1, num(dur[1]) / BATTLE_SECONDS), why: `${dur[1]}s of a ${BATTLE_SECONDS}s battle` };
  }
  const every = /every (\d+(?:\.\d+)?) seconds?/i.exec(text);
  if (dur && every) return { f: Math.min(1, num(dur[1]) / num(every[1])), why: `${dur[1]}s every ${every[1]}s` };
  if (dur && ability) {
    const p = ABILITY_PERIOD.get(ability) * (times ? num(times[1]) : 1);
    return { f: Math.min(1, num(dur[1]) / p), why: `${dur[1]}s per ${ability} (every ${p}s)` };
  }
  if (status) return { f: status.f, why: status.why };
  if (dur) return { f: 0.5, why: `${dur[1]}s after a trigger 0.5` };
  if (/\b(when|whenever|each time|after)\b/i.test(text)) return { f: 0.5, why: 'after a trigger 0.5' };
  return { f: 1, why: '' };
}

function reachOf(text) {
  if (OTHERS_ALL.test(text) && !/nearby/i.test(text)) return { f: 1, why: 'all Dudes' };
  if (OTHERS_NEARBY.test(text) && !/\d nearby dudes/i.test(text)) return { f: 0.6, why: 'nearby Dudes 0.6' };
  if (OTHERS_FEW.some((re) => re.test(text))) return { f: 0.4, why: 'a few Dudes 0.4' };
  return null;
}

/** A subject's tokens: does it name the owner (or he/him), another Dude Type, or a group of Dudes? */
function subjectOf(tokens, owner) {
  const named = tokens.filter(([k, t]) => k === 'v' && DUDE_NAMES.has(t)).map(([, t]) => t);
  const text = plain(tokens);
  let others = reachOf(text.replace(SELF_WORDS, ''));
  if (!others && named.some((n) => n !== owner)) others = { f: 0.4, why: 'another Dude Type 0.4' };
  return { self: SELF_WORDS.test(text) || named.includes(owner), others, enemy: /\benem/i.test(text) };
}

/** Text tokens after the last comma (the subject right before a verb). */
function afterLastComma(tokens) {
  for (let k = tokens.length - 1; k >= 0; k--) {
    const [kind, text] = tokens[k];
    if (kind === 't' && text.includes(',')) return [['t', text.slice(text.lastIndexOf(',') + 1)], ...tokens.slice(k + 1)];
  }
  return tokens;
}

/** The last grant verb in a clause before token index i: { verbAt (token), verbIndex (in its text), verb }. */
function lastVerbBefore(clause, i) {
  let found = null;
  for (let k = 0; k < i; k++) {
    const m = clause[k][0] === 't' ? [...clause[k][1].matchAll(GRANT_VERB)].at(-1) : null;
    if (m) found = { verbAt: k, verbIndex: m.index, verb: m[1].toLowerCase() };
  }
  return found;
}

/** "gains / gets": the clause's own subject receives the stat. */
function gainRecipients(subject) {
  if (subject.enemy && !subject.self && !subject.others) return null;
  return { self: subject.self || !subject.others, others: subject.others };
}

/** "grants / granting / gaining": the clause's subject, or the object (between the verb and the value, or "to …" after). */
function grantRecipients(clause, i, owner, head, found) {
  const { verbAt, verbIndex, verb } = found;
  const after = plain(clause.slice(i));
  const object = clause[verbAt][1].slice(verbIndex + verb.length) + plain(clause.slice(verbAt + 1, i)) + (/\bto ([^,.]*)/i.exec(after)?.[1] ?? '');
  const objectReach = verb === 'gaining' ? null : reachOf(object);
  if (objectReach) return { self: /\bhimself\b/i.test(object), others: objectReach };
  if (verb === 'granting' || verb === 'gaining') {
    const whole = subjectOf(head, owner);
    if (verb === 'granting') return { self: false, others: whole.others };
    // "… is chosen as MVP, gaining …": others when the clause is about someone else, else the owner himself
    return whole.others && !whole.self ? { self: false, others: whole.others } : { self: true, others: null };
  }
  return { self: true, others: null };
}

/** Who receives the stat at token index i of a clause: self, others (with reach) or both; null = not to Dudes. */
function recipients(clause, i, owner) {
  const found = lastVerbBefore(clause, i);
  if (!found) return null;
  const { verbAt, verbIndex, verb } = found;
  const head = [...clause.slice(0, verbAt), ['t', clause[verbAt][1].slice(0, verbIndex)]];
  const status = head.map(([k, t]) => (k === 'g' ? STATUS[t] : undefined)).findLast(Boolean);
  if (status && verb.startsWith('gr')) {
    return status.to === 'self' ? { self: true, others: null, status } : { self: false, others: { f: 0.4, why: status.why }, status };
  }
  if (/^(gains?|gets?)$/.test(verb)) return gainRecipients(subjectOf(afterLastComma(head), owner));
  return grantRecipients(clause, i, owner, head, found);
}

/** Text between two stats of a list ("20% Toughness and Attack Power"). */
const LIST_GLUE = new Set(['', ',', 'and', ', and']);

/** Columns given at token index i: "20% Toughness" plus a list that shares the value ("20% Toughness and Attack Power"). */
function statsAt(s, i) {
  const cols = [];
  let j = i + 1;
  while (j < s.length) {
    while (s[j]?.[0] === 't' && LIST_GLUE.has(s[j][1].trim())) j++;
    const col = s[j]?.[0] === 'g' ? TERM_TO_COL[s[j][1]] : undefined;
    if (!col) break;
    cols.push(col);
    j++;
  }
  return { cols, end: j };
}

/** Index where the run of digits ending just before `end` starts (= end when there is none). */
function digitsStart(text, end) {
  let start = end;
  while (start > 0 && /\d/.test(text[start - 1])) start--;
  return start;
}

/** "N% chance" before the stat: the number as text, or null. Walks back from "% chance" over the digits. */
function chanceBefore(text) {
  const lower = text.toLowerCase();
  for (let at = lower.indexOf('% chance'); at >= 0; at = lower.indexOf('% chance', at + 1)) {
    let start = digitsStart(lower, at);
    if (start === at) continue;
    const whole = lower[start - 1] === '.' ? digitsStart(lower, start - 1) : start - 1;
    if (whole < start - 1) start = whole;
    return lower.slice(start, at);
  }
  return null;
}

/** value × stacks × uptime × chance for the stat at token index i, with its explanation parts. */
function estimateAt(s, i, end, next, who) {
  const text = plain(s);
  const cap = /up to (?:a maximum of )?(\d+(?:\.\d+)?)%|maximum of (\d+(?:\.\d+)?)%/i.exec(text);
  const st = cap ? { n: 1, why: '' } : stacksOf(text, next, plain(s.slice(end)));
  const base = cap ? num(cap[1] ?? cap[2]) : num(s[i][1]);
  const up = uptimeOf(text, s, who.status);
  const chance = chanceBefore(plain(s.slice(0, i)));
  const parts = [`${base}%${cap ? ' (cap)' : ''}`];
  if (st.why) parts.push(st.why);
  if (up.why) parts.push(up.why);
  if (chance) parts.push(`${chance}% chance`);
  return { parts, amount: base * st.n * up.f * (chance ? num(chance) / 100 : 1) };
}

/** The grants (self and/or team) of the stat at token index i of a clause; [] when it isn't a grant to Dudes. */
function grantsAt(name, s, i, owner, next) {
  const { cols, end } = statsAt(s, i);
  if (!cols.length) return [];
  const found = recipients(s, i, owner);
  if (!found) return [];
  const who = REACH_OVERRIDES[name] ? { ...found, others: REACH_OVERRIDES[name] } : found;
  const { parts, amount } = estimateAt(s, i, end, next, who);
  const out = [];
  for (const col of cols) {
    if (who.self) out.push({ col, kind: 'self', v: amount, src: `${name}: ${parts.join(' × ')}` });
    if (who.others) {
      const why = who.status ? 'a few Dudes 0.4' : who.others.why;
      out.push({ col, kind: 'team', v: amount * who.others.f, src: `${name}: ${[...parts, why].join(' × ')}` });
    }
  }
  return out;
}

/** All stat grants in one description: [{col, kind: 'self'|'team', v, src}] */
function grantsOf(name, desc, owner) {
  const out = [];
  const sents = sentences(desc);
  sents.forEach((sent, si) => {
    const next = sents[si + 1] ? plain(sents[si + 1]) : '';
    for (const s of clauses(sent)) {
      if (/each second/i.test(plain(s))) continue; // ramps over the battle; too fuzzy to estimate
      for (let i = 0; i < s.length; i++) {
        if (isPct(s[i])) out.push(...grantsAt(name, s, i, owner, next));
      }
    }
  });
  return out;
}

const rows = {};
/** The { self, team, src } cell of a row and column, created on first use. */
function cellOf(key, col) {
  rows[key] ??= {};
  rows[key][col] ??= { self: 0, team: 0, src: [] };
  return rows[key][col];
}
function add(key, name, desc) {
  for (const g of grantsOf(name, desc, nameOf.get(key))) {
    const cell = cellOf(key, g.col);
    cell[g.kind] += g.v;
    cell.src.push(`${g.kind === 'team' ? 'Teammates' : 'Himself'}, ${g.src}`);
  }
}

for (const d of game.dudes) if (d.ability) add(d.id, d.ability.name, d.ability.desc);
for (const r of game.relics) {
  if (r.scope === 'dude') for (const d of r.dudes ?? []) add(d, r.name, r.desc);
  else if (r.scope === 'family') add(`family:${r.family}`, r.name, r.desc);
  else add('group:universal', r.name, r.desc);
}

// ----- Healing: HP per second from the hand-extracted table in heal-sources.mjs -----
// HP/s = amount (from its basis) × Dudes healed × events per second × chance; "mult" entries then boost a named
// source of the same owner. Uses the owner's Dudex base stats (team averages for Family/Universal rows).
// Assumptions (as in the chart author's sheet): he takes 1 hit per second; a healed Dude has the average Max HP;
// unknown ability cooldowns = 4 s.
const statNum = (d, key) => Number.parseFloat(String(d.stats?.[key] ?? '0').replaceAll(',', '').replace('%', '')) || 0;
const recruitable = game.dudes.filter((d) => d.stats && statNum(d, 'hpmax') > 0);
const avg = (key) => recruitable.reduce((s, d) => s + statNum(d, key), 0) / recruitable.length;
const AVERAGE = { hpmax: avg('hpmax'), dps: avg('dps'), damage: avg('damage'), attack_speed: avg('attack_speed'), crit_chance: avg('crit_chance') };
const statsOf = (owner) => {
  const d = game.dudes.find((x) => x.id === owner);
  if (!d) return AVERAGE;
  return Object.fromEntries(Object.keys(AVERAGE).map((k) => [k, statNum(d, k)]));
};
const ONE_DECIMAL = (v) => Math.round(v * 100) / 100;

function healAmount(h, st) {
  switch (h.basis) {
    case 'flat': return { v: h.amount, why: `${h.amount} HP` };
    case 'dps': return { v: h.amount * st.dps, why: `${h.amount * 100}% of DPS ${st.dps}` };
    case 'atk': return { v: h.amount * st.damage, why: `${h.amount * 100}% of Attack Power ${st.damage}` };
    case 'own_maxhp': return { v: h.amount * st.hpmax, why: `${h.amount * 100}% of his Max HP ${st.hpmax}` };
    case 'target_maxhp': return { v: h.amount * AVERAGE.hpmax, why: `${h.amount * 100}% of an average Max HP ${Math.round(AVERAGE.hpmax)}` };
    case 'damage_dealt': return { v: h.amount * st.dps, why: `${h.amount * 100}% of damage dealt (DPS ${st.dps})` };
    case 'damage_taken': return { v: h.amount * 0.1 * st.hpmax, why: `${h.amount * 100}% of damage taken (10% Max HP/s)` };
    default: return null;
  }
}

function healRate(h, st) {
  if (h.trigger === 'other') return null; // can't be timed (Fatal saves, other Dudes' Lifesteal…): left out
  if (h.basis === 'damage_dealt' || h.basis === 'damage_taken') return { v: 1, why: 'per second' };
  switch (h.trigger) {
    case 'periodic': return h.period ? { v: 1 / h.period, why: `every ${h.period}s` } : null;
    case 'on_attack': return { v: st.attack_speed, why: `${st.attack_speed} attacks/s` };
    case 'damage_total': return h.per ? { v: st.dps / h.per, why: `every ${h.per} damage (${ONE_DECIMAL(st.dps / h.per)}/s)` } : null;
    case 'on_hit_taken': return { v: 1, why: '1 hit taken/s' };
    case 'on_crit': {
      const crit = st.crit_chance / 100;
      return { v: st.attack_speed * crit, why: `${st.attack_speed} attacks/s × ${st.crit_chance}% crit` };
    }
    case 'ability': {
      const p = ABILITY_PERIOD.get(h.ability) ?? 4;
      return { v: 1 / p, why: `per ${h.ability ?? 'ability'} (every ${p}s)` };
    }
    case 'battle_start': return { v: 1 / BATTLE_SECONDS, why: `once per ${BATTLE_SECONDS}s battle` };
    default: return null;
  }
}

const { HEAL_SOURCES } = await import('./heal-sources.mjs');
const healHps = new Map(); // `${owner}|${source}` → { owner, kind, v, why }
for (const h of HEAL_SOURCES) {
  if (h.basis === 'mult') continue;
  const st = statsOf(h.owner);
  const amount = healAmount(h, st);
  const rate = healRate(h, st);
  if (!amount || !rate) continue;
  const targets = h.targets ?? 1;
  const chance = h.chance ?? 1;
  const parts = [amount.why];
  if (targets > 1) parts.push(`${targets} Dudes`);
  parts.push(rate.why);
  if (chance < 1) parts.push(`${chance * 100}% chance`);
  const k = `${h.owner}|${h.source}`;
  const prev = healHps.get(k);
  const entry = { owner: h.owner, source: h.source, kind: h.to === 'self' ? 'self' : 'team', v: amount.v * targets * rate.v * chance, why: parts.join(' × ') };
  healHps.set(prev ? `${k}|${healHps.size}` : k, entry);
}
// Multipliers first, then healing added on top of a source ("also Heals for 30% of the HP Donated"), then transfers.
const mults = HEAL_SOURCES.filter((h) => h.basis === 'mult' && h.multiplies);
for (const h of mults.filter((m) => !m.addsHealing)) {
  const target = healHps.get(`${h.owner}|${h.multiplies}`);
  if (!target) continue;
  target.v *= 1 + h.amount;
  target.why += ` × ${1 + h.amount} (${h.source})`;
}
for (const h of mults.filter((m) => m.addsHealing)) {
  const target = healHps.get(`${h.owner}|${h.multiplies}`);
  if (!target) continue;
  target.extra = (target.extra ?? 0) + target.v * h.amount;
  target.extraWhy = ` + ${h.amount * 100}% of it as new healing (${h.source})`;
}
/** A transfer moves the giver's own HP to a teammate (Blood Pump): worth half of new healing. */
const TRANSFER_VALUE = 0.5;
for (const h of HEAL_SOURCES.filter((x) => x.transfer)) {
  const target = healHps.get(`${h.owner}|${h.source}`);
  if (!target) continue;
  target.v *= TRANSFER_VALUE;
  target.why += ` × ${TRANSFER_VALUE} (his own HP, a transfer)`;
}
for (const e of healHps.values()) {
  if (!e.extra) continue;
  e.v += e.extra;
  e.why += e.extraWhy;
}
for (const e of healHps.values()) {
  const cell = cellOf(e.owner, 'heal');
  cell[e.kind] += e.v;
  cell.src.push(`${e.kind === 'team' ? 'Teammates' : 'Himself'}, ${e.source}: ${e.why} = ${ONE_DECIMAL(e.v)} HP/s`);
}

// Best Dude per column (team and self separately); every row is graded against it.
const best = { self: {}, team: {} };
for (const [key, cols] of Object.entries(rows)) {
  if (key.includes(':')) continue;
  for (const [col, c] of Object.entries(cols)) {
    for (const kind of ['self', 'team']) {
      if (c[kind] > (best[kind][col]?.v ?? 0)) best[kind][col] = { v: c[kind], key };
    }
  }
}
const grade = (ratio) => {
  if (ratio >= 0.95) return 'S';
  if (ratio >= 0.85) return 'A';
  if (ratio >= 0.7) return 'B';
  if (ratio >= 0.5) return 'C';
  if (ratio >= 0.3) return 'D';
  if (ratio >= 0.2) return 'E';
  return 'F';
};
const round = (v) => Math.round(v * 10) / 10;
const out = { best: { self: {}, team: {} }, rows: {} };
for (const kind of ['self', 'team']) {
  for (const [col, b] of Object.entries(best[kind])) out.best[kind][col] = { v: round(b.v), key: b.key };
}
for (const [key, cols] of Object.entries(rows)) {
  out.rows[key] = {};
  for (const [col, c] of Object.entries(cols)) {
    const cell = { src: c.src };
    for (const kind of ['self', 'team']) {
      const top = Math.max(MIN_BEST, best[kind][col]?.v ?? c[kind]);
      if (c[kind] > 0) cell[kind] = { v: round(c[kind]), g: grade(c[kind] / top) };
    }
    out.rows[key][col] = cell;
  }
}
writeFileSync(new URL('../src/data/grades.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`grades.json: ${Object.keys(out.rows).length} rows`);
