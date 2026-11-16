import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnalysisPanel } from './components/Analysis';
import { DudePicker } from './components/DudePicker';
import { ItemPicker } from './components/ItemPicker';
import { Roster } from './components/Roster';
import { Modal, Sprite } from './components/bits';
import { dudeById, relicById, relics, SCRAPED_AT, SOURCE, trinkets } from './data/game';
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
  unlockedTypes,
  canAddType,
  countedTypes,
  flyersLeft,
  clampProjected,
  MAX_TYPES,
} from './lib/comp';
import { analyse } from './lib/synergy';
import { anchorFocus, columnById, RELIC_GIVES } from './data/chart';
import { CREDITS } from './credits';
import { ChartView } from './components/ChartView';
import { FlyerBar, RunStart } from './components/FlyerBar';
import { RelicStash } from './components/RelicStash';
import { RelicsPanel } from './components/RelicsPanel';
import { VersionButton } from './components/Changelog';
import { ratioPlan } from './lib/ratio';
import { teamStats } from './lib/stats';

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
  const [linkToCopy, setLinkToCopy] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  // Opened from a share link: keep the comp, drop the hash so edits don't fight it.
  useEffect(() => {
    if (location.hash.includes('c=')) history.replaceState(null, '', location.pathname + location.search);
  }, []);
  useEffect(() => storeDraft(comp), [comp]);

  const analysis = useMemo(() => analyse(comp), [comp]);
  const plan = useMemo(() => ratioPlan(comp), [comp]);
  const stats = useMemo(() => teamStats(comp), [comp]);
  // Breakdown totals use the same buffed stats as the Roster rows.
  const shownAnalysis = useMemo(() => {
    let totalHp = 0;
    let totalDps = 0;
    for (const e of comp.roster) {
      const s = stats.get(e.key)?.stats ?? [];
      totalHp += (s.find((x) => x.key === 'hpmax')?.value ?? 0) * e.count;
      totalDps += (s.find((x) => x.key === 'dps')?.value ?? 0) * e.count;
    }
    return { ...analysis, totalHp, totalDps };
  }, [analysis, stats, comp.roster]);
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

  /**
   * Focus stats picked for you from a Dude ("build around him"). The note in Build around shows while they're
   * unchanged, with Undo back to `previous` when it replaced stats you had.
   */
  const [autoFocus, setAutoFocus] = useState<{ dude: string; cols: string[]; previous: string[] } | null>(null);
  const buildAround = (id: string) => {
    const cols = anchorFocus(id);
    if (!cols.length) return;
    const previous = comp.focus.filter((c) => !cols.includes(c)).length ? comp.focus : [];
    patch({ focus: cols });
    setAutoFocus({ dude: id, cols, previous });
    const names = cols.map((c) => columnById.get(c)?.label ?? c).join(', ');
    flash(`Building around ${dudeById.get(id)?.name ?? id}: focus set to ${names}`);
  };
  const undoBuildAround = () => {
    if (!autoFocus) return;
    patch({ focus: autoFocus.previous });
    setAutoFocus(null);
  };
  /** The first non-Regular Dude on the Roster always sets the focus stats (Undo brings back any you had). */
  const autoFocusFor = (id: string) => {
    if (id === 'basic' || countedTypes(comp.roster) > 0) return;
    buildAround(id);
  };

  const addDude = (id: string) => {
    if (!canAddType(comp.roster, id)) {
      flash(`Your Roster is full: Regular Dude plus ${MAX_TYPES} other types. Remove one to add another.`);
      return;
    }
    setComp((c) => {
      const existing = c.roster.find((e) => e.dude === id);
      if (existing) {
        return { ...c, roster: c.roster.map((e) => (e === existing ? { ...e, count: Math.min(999, e.count + 1) } : e)) };
      }
      if (!canAddType(c.roster, id)) return c;
      return { ...c, roster: [...c.roster, { key: newKey(), dude: id, count: 1, trinket: null }] };
    });
    autoFocusFor(id);
  };

  const toggleRelic = (id: string) =>
    setComp((c) => ({ ...c, relics: c.relics.includes(id) ? c.relics.filter((r) => r !== id) : [...c.relics, id] }));

  // ----- Run tracking: flyers unlock Dude Types, picks go straight onto the Roster. -----

  /**
   * keep: start from the current Roster. Its types are Ensemble pre-picks (none = standard run).
   * fresh: reset to a single Regular Dude. Either way the run always has a Regular Dude.
   */
  const startRun = (mode: 'keep' | 'fresh') => {
    const regular = { key: newKey(), dude: 'basic', count: 1, trinket: null };
    if (mode === 'fresh') {
      setComp({ ...emptyComp(), run: true, roster: [regular] });
      setSavedId(null);
      return;
    }
    setComp((c) => ({
      ...c,
      run: true,
      flyers: [],
      roster: c.roster.some((e) => e.dude === 'basic') ? c.roster : [regular, ...c.roster],
    }));
  };

  const setOffer = (offer: string[]) =>
    setComp((c) => {
      const decided = c.flyers.filter((f) => f.pick);
      return { ...c, flyers: offer.length ? [...decided, { offer, pick: null }] : decided };
    });

  const pickFlyer = (id: string) => {
    // The pick happened in-game, so always record it; only add to the Roster if there's room.
    const fits = canAddType(comp.roster, id);
    if (!fits) flash(`${dudeById.get(id)?.name ?? 'That Dude'} is unlocked, but your Roster is full. Remove a type to add it.`);
    setComp((c) => {
      const decided = c.flyers.filter((f) => f.pick);
      const draft = c.flyers.find((f) => !f.pick);
      const add = !c.roster.some((e) => e.dude === id) && canAddType(c.roster, id);
      return {
        ...c,
        flyers: [...decided, { offer: draft?.offer ?? [id], pick: id }],
        roster: add ? [...c.roster, { key: newKey(), dude: id, count: 1, trinket: null }] : c.roster,
      };
    });
    if (fits) autoFocusFor(id);
  };

  const undoFlyer = () =>
    setComp((c) => {
      const decided = c.flyers.filter((f) => f.pick);
      if (c.flyers.some((f) => !f.pick)) return { ...c, flyers: decided };
      const last = decided.at(-1)?.pick;
      return { ...c, flyers: decided.slice(0, -1), roster: c.roster.filter((e) => e.dude !== last) };
    });

  const endRun = () => setComp((c) => ({ ...c, run: false, flyers: [] }));

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
      // Clipboard blocked (e.g. insecure context): show the link so it can be copied by hand.
      setLinkToCopy(url);
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


  // Run tracking: the flyer bar during a run, the start card otherwise. Once every flyer is used (5 Dude Types),
  // there's nothing left to track, so neither shows.
  let runPanel: ReactNode = null;
  if (flyersLeft(comp.roster) > 0) {
    runPanel = comp.run ? (
      <FlyerBar
        flyers={comp.flyers}
        pool={[...new Set([...unlockedTypes(comp), ...comp.roster.map((e) => e.dude)])]}
        rosterTypes={comp.roster.map((e) => e.dude)}
        left={flyersLeft(comp.roster)}
        stage={countedTypes(comp.roster)}
        focus={comp.focus}
        relics={comp.relics}
        onOffer={setOffer}
        onPick={pickFlyer}
        onUndo={undoFlyer}
        onEnd={endRun}
        onFocus={(focus) => patch({ focus })}
      />
    ) : (
      <RunStart typeCount={countedTypes(comp.roster)} hasRoster={comp.roster.length > 0} onStart={startRun} />
    );
  }

  const analysisPanel = (
    <AnalysisPanel
      analysis={shownAnalysis}
      focus={comp.focus}
      notes={comp.notes}
      onNotes={(notes) => patch({ notes })}
      onToggleFocus={toggleFocus}
      onFindRelics={setRelicStat}
      onAddDude={addDude}
      autoFocus={autoFocus}
      onUndoAutoFocus={undoBuildAround}
    />
  );

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
              , {SCRAPED_AT} · <VersionButton />
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
          <button className="btn primary" onClick={copyLink} disabled={!comp.roster.length && !comp.flyers.length}>
            Copy share link
          </button>
        </div>
      </header>

      {view === 'planner' && (
        <main className="layout">
          <DudePicker
            counts={counts}
            focus={comp.focus}
            full={countedTypes(comp.roster) >= MAX_TYPES}
            onAdd={addDude}
            onBuildAround={buildAround}
          />
          <div className="center-col">
            {/* The Roster is what everyone uses, so it leads; run tracking, recruit plan and relic stash are optional helpers. */}
            <Roster
              roster={comp.roster}
              plan={plan}
              stats={stats}
              plannedRelics={planned}
              focus={comp.focus}
              analysis={analysis}
              onChange={(roster) => patch({ roster })}
              onToggleRelic={toggleRelic}
              onPickTrinket={setTrinketFor}
              targets={comp.targets}
              onTarget={(dude, pct) =>
                setComp((c) => {
                  const targets = { ...c.targets };
                  if (pct === null) delete targets[dude];
                  else targets[dude] = pct;
                  return { ...c, targets };
                })
              }
              onResetTargets={() => patch({ targets: {} })}
              onProjected={(n) => patch({ projected: clampProjected(n) })}
              onBuildAround={buildAround}
            />
            {runPanel}
            {comp.roster.length > 0 && (
              <RelicStash
                comp={comp}
                relevant={analysis.relevantRelics}
                onTake={(id) => {
                  setComp((c) => (c.relics.includes(id) ? c : { ...c, relics: [...c.relics, id] }));
                  flash(`Added ${relicById.get(id)?.name ?? 'Relic'} to your Relics`);
                }}
              />
            )}
            <RelicsPanel
              relics={comp.relics}
              unusable={new Set(comp.relics.filter((id) => !shownAnalysis.relevantRelics.has(id)))}
              payoffs={shownAnalysis.teamSynergies}
              onToggle={toggleRelic}
              onOpenPicker={() => setRelicStat('')}
            />
          </div>
          {analysisPanel}
        </main>
      )}
      {view === 'chart' && (
        <main className="layout chart-layout">
          <ChartView focus={comp.focus} counts={counts} onToggleFocus={toggleFocus} onAddDude={addDude} />
          {analysisPanel}
        </main>
      )}

      <ItemPicker
        key={`relics-${relicStat}`}
        open={relicStat !== null}
        title="Your Relics"
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
          and belong to Butterscotch Shenanigans. They are used with permission and are subject to Butterscotch
          Shenanigans’{' '}
          <a href={CREDITS.bscotchTerms} target="_blank" rel="noreferrer">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={CREDITS.bscotchIp} target="_blank" rel="noreferrer">
            Intellectual Property policy
          </a>
          .
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

      <Modal open={linkToCopy !== null} onClose={() => setLinkToCopy(null)} title="Copy this link">
        <div className="copy-box">
          <p className="muted small">Your browser blocked automatic copying. Select the link and copy it.</p>
          <input
            className="input"
            readOnly
            value={linkToCopy ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share link"
          />
        </div>
      </Modal>

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
