import { useMemo, useState } from 'react';
import { dudeById, familyById, tokensText, type Token } from '../data/game';
import { COLUMNS } from '../data/chart';
import { ColChip, Desc, Modal, Sprite } from './bits';

export interface PickItem {
  id: string;
  name: string;
  icon: string;
  desc: Token[];
  scope?: 'global' | 'family' | 'dude';
  family?: string;
  dudes?: string[];
}

interface Props {
  open: boolean;
  title: string;
  items: PickItem[];
  selected: Set<string>;
  /** Items worth showing first (e.g. relics usable by this roster). */
  relevant?: Set<string>;
  multi: boolean;
  /** Stats each item gives; enables the stat filter. */
  gives?: Map<string, string[]>;
  initialStat?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** Columns a Relic can give (detected from its text). */
const RELIC_COLUMNS = COLUMNS.filter((c) => c.relicTerm || c.id === 'heal');

const scopeLabel = (it: PickItem) => {
  if (it.scope === 'family' && it.family) return `${familyById.get(it.family)?.name} Family`;
  if (it.scope === 'dude' && it.dudes) return it.dudes.map((d) => dudeById.get(d)?.name).join(', ');
  if (it.scope === 'global') return 'Any team';
  return '';
};

export function ItemPicker({ open, title, items, selected, relevant, multi, gives, initialStat = '', onPick, onClose }: Readonly<Props>) {
  const [query, setQuery] = useState('');
  const [onlyRelevant, setOnlyRelevant] = useState(true);
  const [stat, setStat] = useState<string>(initialStat);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => !relevant || !onlyRelevant || relevant.has(it.id) || selected.has(it.id))
      .filter((it) => !stat || !gives || (gives.get(it.id) ?? []).includes(stat))
      .filter(
        (it) =>
          !q ||
          it.name.toLowerCase().includes(q) ||
          tokensText(it.desc).toLowerCase().includes(q) ||
          scopeLabel(it).toLowerCase().includes(q),
      )
      .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || a.name.localeCompare(b.name));
  }, [items, query, relevant, onlyRelevant, selected, stat, gives]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="picker-tools">
        <input
          className="input"
          type="search"
          placeholder="Search by name, effect or Dude"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {gives && (
          <select
            className="input stat-select"
            value={stat}
            onChange={(e) => setStat(e.target.value)}
            aria-label="Filter by stat given"
          >
            <option value="">Gives any stat</option>
            {RELIC_COLUMNS.map((s) => (
              <option key={s.id} value={s.id}>
                Gives {s.label}
              </option>
            ))}
          </select>
        )}
        {relevant && (
          <label className="check">
            <input type="checkbox" checked={onlyRelevant} onChange={(e) => setOnlyRelevant(e.target.checked)} />
            Only Relics this Roster can use
          </label>
        )}
        <span className="muted">{list.length} shown</span>
      </div>
      <ul className="item-list">
        {list.map((it) => {
          const on = selected.has(it.id);
          return (
            <li key={it.id}>
              <button
                className="item"
                aria-pressed={on}
                onClick={() => {
                  onPick(it.id);
                  if (!multi) onClose();
                }}
              >
                <Sprite id={it.icon} size={40} />
                <span className="item-text">
                  <span className="item-name">
                    {it.name}
                    {scopeLabel(it) && <span className="item-scope">{scopeLabel(it)}</span>}
                    {gives?.get(it.id)?.map((s) => (
                      <ColChip key={s} col={s} compact />
                    ))}
                  </span>
                  <span className="item-desc">
                    <Desc tokens={it.desc} />
                  </span>
                </span>
                <span className="item-state" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="empty">
            {query ? `Nothing matches “${query}”.` : 'Nothing matches these filters.'}
            {relevant && onlyRelevant && ' Untick “Only Relics this Roster can use” to see more.'}
          </li>
        )}
      </ul>
    </Modal>
  );
}
