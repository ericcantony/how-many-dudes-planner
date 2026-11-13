import { columnById } from '../data/chart';
import { dudeById, relicById, trinketById } from '../data/game';

/** One Dude Type on the roster. Order in the roster array is the in-game Roster order (top first). */
export interface Entry {
  /** Stable key for drag-and-drop. */
  key: string;
  dude: string;
  count: number;
  trinket: string | null;
}

export interface Comp {
  name: string;
  notes: string;
  roster: Entry[];
  /** Relics planned for this run (global, family and dude-specific). */
  relics: string[];
  /** Chart columns the comp is built around (e.g. crit, cleave, evasion). */
  focus: string[];
  /** Flyer rounds of the current run, in order. The last one may still be undecided (pick null). */
  flyers: Flyer[];
  /** True while tracking a live run: the flyer bar shows and Recruit is limited to unlocked types. */
  run: boolean;
}

/** A flyer round: up to 3 offered Dude Types; picking one unlocks it for recruiting. */
export interface Flyer {
  offer: string[];
  pick: string | null;
}

/** A Roster holds Regular Dude plus at most this many other Dude Types. */
export const MAX_TYPES = 5;

/** Dude Types on the Roster that count toward MAX_TYPES (everything but Regular Dude). */
export const countedTypes = (roster: Entry[]) => new Set(roster.map((e) => e.dude).filter((d) => d !== 'basic')).size;

/** Whether this Dude Type can join the Roster without breaking the type limit. */
export const canAddType = (roster: Entry[], dude: string) =>
  dude === 'basic' || roster.some((e) => e.dude === dude) || countedTypes(roster) < MAX_TYPES;

/**
 * Flyers left in the run: one for every free type slot. A standard run (only Regular Dude) has 5;
 * Ensemble mode pre-picks 0–5 types, leaving 5 minus that many. Adding a type by hand uses a flyer up.
 */
export const flyersLeft = (roster: Entry[]) => Math.max(0, MAX_TYPES - countedTypes(roster));

export const emptyComp = (): Comp => ({ name: '', notes: '', roster: [], relics: [], focus: [], flyers: [], run: false });

/** Dude Types unlocked by the run so far (Regular Dude is always available). */
export const unlockedTypes = (c: Comp) => ['basic', ...c.flyers.map((f) => f.pick).filter((p): p is string => !!p)];

let keySeq = 0;
export const newKey = () => `e${Date.now().toString(36)}${(keySeq++).toString(36)}`;

// ---------- Sharing: compact, URL-safe encoding ----------
// Format (before base64url): name \n notes \n dude*count~trinket,dude*count \n relic,relic \n focus,focus \n flyers \n run ("1" while tracking a run)
// Flyers: "offer1.offer2.offer3>pick" per round, comma-separated; an undecided round ends with ">".
// Only ever append new fields so old links keep working.

const b64urlEncode = (s: string) =>
  btoa(String.fromCodePoint(...new TextEncoder().encode(s)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const b64urlDecode = (s: string) => {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.codePointAt(0) ?? 0));
};

const encodeFlyers = (flyers: Flyer[]) => flyers.map((f) => `${f.offer.join('.')}>${f.pick ?? ''}`).join(',');

function decodeFlyers(text: string): Flyer[] {
  const out: Flyer[] = [];
  for (const part of text.split(',').filter(Boolean)) {
    const [offer = '', pick = ''] = part.split('>');
    const ids = offer.split('.').filter((d) => dudeById.has(d)).slice(0, 3);
    out.push({ offer: ids, pick: ids.includes(pick) ? pick : null });
    if (out.length === MAX_TYPES) break;
  }
  // Only the last flyer may be undecided.
  return out.filter((f, i) => f.pick || i === out.length - 1);
}

export function encodeComp(c: Comp): string {
  const roster = c.roster.map((e) => `${e.dude}*${e.count}${e.trinket ? `~${e.trinket}` : ''}`).join(',');
  const clean = (s: string) => s.replaceAll('\n', ' ');
  const fields = [clean(c.name), clean(c.notes), roster, c.relics.join(','), c.focus.join(','), encodeFlyers(c.flyers), c.run ? '1' : ''];
  return b64urlEncode(fields.join('\n'));
}

export function decodeComp(code: string): Comp | null {
  try {
    const [name = '', notes = '', roster = '', relics = '', focus = '', flyers = '', run = ''] = b64urlDecode(code).split('\n');
    const entries: Entry[] = [];
    for (const part of roster.split(',').filter(Boolean)) {
      const m = /^([^*~]+)\*(\d+)(?:~(.+))?$/.exec(part);
      if (!m || !dudeById.has(m[1])) continue;
      entries.push({
        key: newKey(),
        dude: m[1],
        count: Math.max(1, Math.min(999, Number(m[2]))),
        trinket: m[3] && trinketById.has(m[3]) ? m[3] : null,
      });
    }
    return {
      name,
      notes,
      roster: entries,
      relics: relics.split(',').filter((r) => relicById.has(r)),
      focus: focus.split(',').filter((f) => columnById.has(f)),
      flyers: decodeFlyers(flyers),
      run: run === '1',
    };
  } catch {
    return null;
  }
}

export const shareUrl = (c: Comp) => `${location.origin}${location.pathname}#c=${encodeComp(c)}`;

export function compFromHash(): Comp | null {
  const m = /[#&]c=([\w-]+)/.exec(location.hash);
  return m ? decodeComp(m[1]) : null;
}

// ---------- Local storage ----------

export interface SavedComp {
  id: string;
  savedAt: number;
  code: string;
}

const SAVED_KEY = 'hmd-planner:saved';
const DRAFT_KEY = 'hmd-planner:draft';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}

export const loadSaved = () => read<SavedComp[]>(SAVED_KEY, []);
export const storeSaved = (list: SavedComp[]) => write(SAVED_KEY, list);
export const loadDraft = () => {
  const code = read<string | null>(DRAFT_KEY, null);
  return code ? decodeComp(code) : null;
};
export const storeDraft = (c: Comp) => write(DRAFT_KEY, encodeComp(c));
