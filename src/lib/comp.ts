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
}

export const emptyComp = (): Comp => ({ name: '', notes: '', roster: [], relics: [], focus: [] });

let keySeq = 0;
export const newKey = () => `e${Date.now().toString(36)}${(keySeq++).toString(36)}`;

// ---------- Sharing: compact, URL-safe encoding ----------
// Format (before base64url): name \n notes \n dude*count~trinket,dude*count \n relic,relic \n focus,focus

const b64urlEncode = (s: string) =>
  btoa(String.fromCodePoint(...new TextEncoder().encode(s)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const b64urlDecode = (s: string) => {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.codePointAt(0) ?? 0));
};

export function encodeComp(c: Comp): string {
  const roster = c.roster.map((e) => `${e.dude}*${e.count}${e.trinket ? `~${e.trinket}` : ''}`).join(',');
  const clean = (s: string) => s.replaceAll('\n', ' ');
  return b64urlEncode([clean(c.name), clean(c.notes), roster, c.relics.join(','), c.focus.join(',')].join('\n'));
}

export function decodeComp(code: string): Comp | null {
  try {
    const [name = '', notes = '', roster = '', relics = '', focus = ''] = b64urlDecode(code).split('\n');
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
