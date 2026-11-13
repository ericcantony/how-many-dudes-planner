import { useEffect, useMemo, useRef, useState } from 'react';
import { AnalysisPanel } from './components/Analysis';
import { DudePicker } from './components/DudePicker';
import { ItemPicker } from './components/ItemPicker';
import { Roster } from './components/Roster';
import { Sprite } from './components/bits';
import { relics, SCRAPED_AT, SOURCE, trinkets } from './data/game';
import {
  compFromHash,
  decodeComp,
  emptyComp,
  encodeComp,
  loadDraft,
  loadSaved,
  newKey,
  shareUrl,
  storeDraft,
  storeSaved,
  type Comp,
  type SavedComp,
} from './lib/comp';
import { analyse } from './lib/synergy';
import { RELIC_GIVES } from './data/chart';
import { CREDITS } from './credits';
import { ChartView } from './components/ChartView';

function initialComp(): Comp {
  return compFromHash() ?? loadDraft() ?? emptyComp();
}

export default function App() {
  const [comp, setComp] = useState<Comp>(initialComp);
  const [saved, setSaved] = useState<SavedComp[]>(loadSaved);
  const [savedId, setSavedId] = useState<string | null>(null);
  /** null = closed; '' = open with no stat filter. */
  const [relicStat, setRelicStat] = useState<string | null>(null);
  const [view, setView] = useState<'planner' | 'chart'>('planner');
  const [trinketFor, setTrinketFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  // Opened from a share link: keep the comp, drop the hash so edits don't fight it.
  useEffect(() => {
    if (location.hash.includes('c=')) history.replaceState(null, '', location.pathname + location.search);
  }, []);
  useEffect(() => storeDraft(comp), [comp]);

  const analysis = useMemo(() => analyse(comp), [comp]);
  const planned = useMemo(() => new Set(comp.relics), [comp.relics]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of comp.roster) m.set(e.dude, (m.get(e.dude) ?? 0) + e.count);
    return m;
  }, [comp.roster]);

  const flash = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  };

  const patch = (p: Partial<Comp>) => setComp((c) => ({ ...c, ...p }));

  const addDude = (id: string) =>
    setComp((c) => {
      const existing = c.roster.find((e) => e.dude === id);
      if (existing) {
        return { ...c, roster: c.roster.map((e) => (e === existing ? { ...e, count: Math.min(999, e.count + 1) } : e)) };
      }
      return { ...c, roster: [...c.roster, { key: newKey(), dude: id, count: 1, trinket: null }] };
    });

  const toggleRelic = (id: string) =>
    setComp((c) => ({ ...c, relics: c.relics.includes(id) ? c.relics.filter((r) => r !== id) : [...c.relics, id] }));

  const toggleFocus = (col: string) =>
    setComp((c) => ({ ...c, focus: c.focus.includes(col) ? c.focus.filter((f) => f !== col) : [...c.focus, col] }));

  const saveComp = () => {
    const code = encodeComp(comp);
    const id = savedId ?? newKey();
    const next = [{ id, savedAt: Date.now(), code }, ...saved.filter((s) => s.id !== id)];
    setSaved(next);
    storeSaved(next);
    setSavedId(id);
    flash(`Saved “${comp.name || 'Untitled comp'}”`);
  };

  const copyLink = async () => {
    const url = shareUrl(comp);
    try {
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  const loadComp = (s: SavedComp) => {
    const c = decodeComp(s.code);
    if (!c) return flash('That saved comp could not be read.');
    setComp(c);
    setSavedId(s.id);
  };

  const deleteSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    storeSaved(next);
    if (savedId === id) setSavedId(null);
  };

  const trinketEntry = comp.roster.find((e) => e.key === trinketFor);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Sprite id="sp_icon_dude_regular" size={40} />
          <div>
            <h1>How Many Dudes? Comp Planner</h1>
            <p className="muted small">
              Data from the{' '}
              <a href={SOURCE} target="_blank" rel="noreferrer">
                official Dudex
              </a>
              , {SCRAPED_AT}
            </p>
          </div>
        </div>
        <input
          className="input comp-name"
          placeholder="Name this comp"
          value={comp.name}
          onChange={(e) => patch({ name: e.target.value })}
          aria-label="Comp name"
        />
        <nav className="view-tabs" aria-label="View">
          <button className="tab" aria-pressed={view === 'planner'} onClick={() => setView('planner')}>
            Planner
          </button>
          <button className="tab" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>
            Synergy chart
          </button>
        </nav>
        <div className="top-actions">
          <button
            className="btn ghost"
            onClick={() => {
              setComp(emptyComp());
              setSavedId(null);
            }}
          >
            New comp
          </button>
          <SavedMenu saved={saved} currentId={savedId} onLoad={loadComp} onDelete={deleteSaved} />
          <button className="btn" onClick={saveComp}>
            {savedId ? 'Save changes' : 'Save'}
          </button>
          <button className="btn primary" onClick={copyLink} disabled={!comp.roster.length}>
            Copy share link
          </button>
        </div>
      </header>

      {view === 'planner' ? (
        <main className="layout">
          <DudePicker counts={counts} focus={comp.focus} onAdd={addDude} />
          <Roster
            roster={comp.roster}
            plannedRelics={planned}
            focus={comp.focus}
            analysis={analysis}
            onChange={(roster) => patch({ roster })}
            onToggleRelic={toggleRelic}
            onPickTrinket={setTrinketFor}
          />
          <AnalysisPanel
          analysis={analysis}
          plannedRelics={comp.relics}
          focus={comp.focus}
          notes={comp.notes}
          onNotes={(notes) => patch({ notes })}
          onToggleRelic={toggleRelic}
          onToggleFocus={toggleFocus}
          onOpenRelics={() => setRelicStat('')}
          onFindRelics={setRelicStat}
          onAddDude={addDude}
        />
        </main>
      ) : (
        <main className="layout chart-layout">
          <ChartView focus={comp.focus} counts={counts} onToggleFocus={toggleFocus} onAddDude={addDude} />
          <AnalysisPanel
          analysis={analysis}
          plannedRelics={comp.relics}
          focus={comp.focus}
          notes={comp.notes}
          onNotes={(notes) => patch({ notes })}
          onToggleRelic={toggleRelic}
          onToggleFocus={toggleFocus}
          onOpenRelics={() => setRelicStat('')}
          onFindRelics={setRelicStat}
          onAddDude={addDude}
        />
        </main>
      )}

      <ItemPicker
        key={`relics-${relicStat}`}
        open={relicStat !== null}
        title="Plan Relics"
        items={relics}
        selected={planned}
        relevant={analysis.relevantRelics}
        gives={RELIC_GIVES}
        initialStat={relicStat ?? ''}
        multi
        onPick={toggleRelic}
        onClose={() => setRelicStat(null)}
      />
      <ItemPicker
        open={!!trinketEntry}
        title="Choose a Trinket"
        items={trinkets}
        selected={new Set(trinketEntry?.trinket ? [trinketEntry.trinket] : [])}
        multi={false}
        onPick={(id) =>
          patch({ roster: comp.roster.map((e) => (e.key === trinketFor ? { ...e, trinket: e.trinket === id ? null : id } : e)) })
        }
        onClose={() => setTrinketFor(null)}
      />

      <footer className="site-footer">
        <p>
          Fan-made and not affiliated with Butterscotch Shenanigans. Game data and art come from the{' '}
          <a href={SOURCE} target="_blank" rel="noreferrer">
            official Dudex
          </a>{' '}
          and belong to Butterscotch Shenanigans.
        </p>
        <p>
          Synergy chart by{' '}
          <a href={CREDITS.chartPost} target="_blank" rel="noreferrer">
            {CREDITS.chartAuthor || 'a community member on r/HowManyDudes'}
          </a>
          .
          {CREDITS.repo && (
            <>
              {' '}
              <a href={CREDITS.repo} target="_blank" rel="noreferrer">
                Source code and bug reports
              </a>
              .
            </>
          )}
        </p>
      </footer>

      <div className="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

function SavedMenu({
  saved,
  currentId,
  onLoad,
  onDelete,
}: Readonly<{
  saved: SavedComp[];
  currentId: string | null;
  onLoad: (s: SavedComp) => void;
  onDelete: (id: string) => void;
}>) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details className="saved-menu" ref={ref}>
      <summary className="btn ghost">Saved ({saved.length})</summary>
      <div className="saved-pop">
        {saved.length === 0 && <p className="muted small">Comps you save appear here. They stay in this browser.</p>}
        <ul>
          {saved.map((s) => {
            const c = decodeComp(s.code);
            return (
              <li key={s.id} className={s.id === currentId ? 'current' : ''}>
                <button
                  className="saved-load"
                  onClick={() => {
                    onLoad(s);
                    ref.current?.removeAttribute('open');
                  }}
                >
                  <strong>{c?.name || 'Untitled comp'}</strong>
                  <span className="muted small">
                    {c?.roster.reduce((n, e) => n + e.count, 0) ?? 0} Dudes, {new Date(s.savedAt).toLocaleDateString()}
                  </span>
                </button>
                <button className="btn icon ghost danger" onClick={() => onDelete(s.id)} aria-label="Delete saved comp">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
