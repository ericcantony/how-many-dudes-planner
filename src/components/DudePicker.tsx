import { useMemo, useState } from 'react';
import { cellOf, columnById, focusScore, selfScaling } from '../data/chart';
import { dudes, families, STAT_LABELS, tokensText, wikiUrl, type Dude } from '../data/game';
import { ChartLines, Desc, FamilyTag, Sprite } from './bits';

interface Props {
  counts: Map<string, number>;
  focus: string[];
  /** The Roster already has the maximum number of Dude Types. */
  full: boolean;
  onAdd: (dudeId: string) => void;
  /** Set the focus stats to this Dude's strongest ones. */
  onBuildAround: (dudeId: string) => void;
}

type Sort = 'default' | 'fit' | 'anchor';

export function DudePicker({ counts, focus, full, onAdd, onBuildAround }: Readonly<Props>) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<string>('all');
  const [preview, setPreview] = useState<Dude | null>(null);
  const [sort, setSort] = useState<Sort>('default');
  const effectiveSort: Sort = sort === 'fit' && !focus.length ? 'default' : sort;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = dudes.filter(
      (d) =>
        !d.summon &&
        (family === 'all' || d.family === family) &&
        (!q || d.name.toLowerCase().includes(q) || d.ability.name.toLowerCase().includes(q) || tokensText(d.ability.desc).toLowerCase().includes(q)),
    );
    if (effectiveSort === 'fit') return [...matches].sort((a, b) => focusScore(b.id, focus) - focusScore(a.id, focus));
    if (effectiveSort === 'anchor') return [...matches].sort((a, b) => selfScaling(b.id) - selfScaling(a.id));
    return matches;
  }, [query, family, effectiveSort, focus]);

  return (
    <section className="panel picker" aria-labelledby="picker-title">
      <h2 id="picker-title" className="panel-title">
        Recruit
      </h2>
      <input
        className="input"
        type="search"
        placeholder="Search Dudes or abilities (e.g. taunt, heal)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <fieldset className="chips" aria-label="Filter by Family">
        <button className="chip" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>
          All
        </button>
        {families.map((f) => (
          <button
            key={f.id}
            className={`chip fam-${f.id}`}
            aria-pressed={family === f.id}
            onClick={() => setFamily(family === f.id ? 'all' : f.id)}
          >
            {f.name}
          </button>
        ))}
      </fieldset>
      <label className="stat-filter">
        <span>Sort</span>
        <select className="input" value={effectiveSort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="default">Alphabetical</option>
          <option value="fit" disabled={!focus.length}>
            Best fit for your focus stats{focus.length ? '' : ' (pick some first)'}
          </option>
          <option value="anchor">Most self-scaling (anchors)</option>
        </select>
      </label>

      <ul className="dude-grid">
        {list.map((d) => {
          const n = counts.get(d.id) ?? 0;
          const blocked = full && n === 0 && d.id !== 'basic';
          return (
            <li key={d.id}>
              <button
                className={`dude-btn fam-${d.family ?? 'none'}${blocked ? ' blocked' : ''}`}
                onClick={() => {
                  onAdd(d.id);
                  setPreview(d);
                }}
                onMouseEnter={() => setPreview(d)}
                onFocus={() => setPreview(d)}
                title={blocked ? `Roster full: remove a type to add ${d.name}` : `Add ${d.name}`}
              >
                <Sprite id={d.icon} size={44} />
                <span className="dude-btn-name">{d.name.replace(/ Dude$/, '')}</span>
                {focus.length > 0 && (
                  <span className="cell-strip" aria-hidden="true">
                    {focus.map((col) => (
                      <span key={col} className={`cell-dot cell-${cellOf(d.id, col) ?? 'none'}`} />
                    ))}
                  </span>
                )}
                {effectiveSort === 'anchor' && selfScaling(d.id) > 0 && (
                  <span className="anchor-n" title="Self-scaling stats (blue cells)">
                    {selfScaling(d.id)}
                  </span>
                )}
                {n > 0 && <span className="badge">{n}</span>}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="empty">No Dudes match “{query}”.</li>}
      </ul>
      {focus.length > 0 && (
        <p className="muted small strip-key">
          Dots under each Dude: {focus.map((c) => columnById.get(c)!.short).join(', ')}.
        </p>
      )}

      {preview && (
        <article className="preview" aria-live="polite">
          <header className="preview-head">
            <Sprite id={preview.icon} size={48} />
            <div>
              <h3>
                <a href={wikiUrl(preview.id)} target="_blank" rel="noreferrer">
                  {preview.name}
                </a>
              </h3>
              <FamilyTag id={preview.family} />
            </div>
          </header>
          <button className="btn small" onClick={() => onBuildAround(preview.id)}>
            Build around {preview.name}
          </button>
          <p className="ability">
            <strong>{preview.ability.name}.</strong> <Desc tokens={preview.ability.desc} />
          </p>
          <ChartLines dudeId={preview.id} />
          <dl className="stats">
            {Object.entries(preview.stats).map(([k, v]) => (
              <div key={k}>
                <dt>{STAT_LABELS[k] ?? k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}
    </section>
  );
}
