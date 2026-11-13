import { useMemo, useState } from 'react';
import { columnById } from '../data/chart';
import { dudeById, dudes } from '../data/game';
import { MAX_TYPES, type Flyer } from '../lib/comp';
import { FLYER_STAGES, gradeOption, suggestFocus, type OptionGrade } from '../lib/flyer';
import { ChartLines, FamilyTag, Sprite } from './bits';
import { ItemPicker } from './ItemPicker';

interface StartProps {
  /** Dude Types on the Roster besides Regular Dude: they become Ensemble pre-picks. */
  typeCount: number;
  /** Whether the Roster has anything a fresh start would throw away. */
  hasRoster: boolean;
  /** keep = start from the current Roster (standard or Ensemble); fresh = reset to Regular Dude. */
  onStart: (mode: 'keep' | 'fresh') => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Shown above the Roster when no run is tracked. */
export function RunStart({ typeCount, hasRoster, onStart }: Readonly<StartProps>) {
  const [confirming, setConfirming] = useState(false);
  const flyers = Math.max(0, MAX_TYPES - typeCount);

  if (confirming) {
    return (
      <section className="panel run-start confirm" aria-label="Confirm fresh run" aria-live="polite">
        <div>
          <h2 className="panel-title">Start fresh?</h2>
          <p className="small">
            This replaces your current Roster, planned Relics and focus stats with a single Regular Dude. Save this comp
            first if you want to keep it.
          </p>
        </div>
        <div className="confirm-actions">
          <button className="btn ghost" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => onStart('fresh')}>
            Start fresh
          </button>
        </div>
      </section>
    );
  }

  const ensemble = typeCount > 0;
  const summary = ensemble
    ? `Ensemble run: your ${plural(typeCount, 'Dude Type')} count as pre-run picks, leaving ${plural(flyers, 'flyer')}.`
    : 'Standard run: start from Regular Dude with 5 flyers.';
  return (
    <section className="panel run-start" aria-label="Track a run">
      <div>
        <h2 className="panel-title">Playing a run?</h2>
        <p className="muted small">
          {summary} Enter each flyer’s 3 options to see which pick fits your team.
        </p>
      </div>
      <div className="confirm-actions">
        {ensemble && (
          <button className="btn ghost" onClick={() => (hasRoster ? setConfirming(true) : onStart('fresh'))}>
            Start fresh
          </button>
        )}
        <button className="btn primary" onClick={() => onStart('keep')}>
          {ensemble ? `Start Ensemble run (${plural(flyers, 'flyer')})` : 'Start run'}
        </button>
      </div>
    </section>
  );
}

interface Props {
  flyers: Flyer[];
  /** Dude Types the team has: unlocked by flyers plus anything on the Roster. Used for grading. */
  pool: string[];
  /** Dude Types already on the Roster: never offered by a flyer. */
  rosterTypes: string[];
  /** Flyers still to come: free type slots on the Roster. */
  left: number;
  /** Dude Types besides Regular already on the team; sets the grading stage. */
  stage: number;
  focus: string[];
  relics: string[];
  /** Update the undecided flyer's offered Dudes. */
  onOffer: (offer: string[]) => void;
  onPick: (dudeId: string) => void;
  onUndo: () => void;
  onEnd: () => void;
  onFocus: (focus: string[]) => void;
}

const SLOTS = [0, 1, 2];

export function FlyerBar({
  flyers,
  pool,
  rosterTypes,
  left,
  stage,
  focus,
  relics,
  onOffer,
  onPick,
  onUndo,
  onEnd,
  onFocus,
}: Readonly<Props>) {
  const decided = flyers.filter((f) => f.pick);
  const draft = flyers.find((f) => !f.pick) ?? { offer: [], pick: null };
  const index = decided.length;
  const total = decided.length + left;
  const done = left === 0;
  const stageInfo = FLYER_STAGES[Math.min(stage, FLYER_STAGES.length - 1)];
  const [choosing, setChoosing] = useState<number | null>(null);

  const grades = useMemo(
    () => draft.offer.map((d) => gradeOption(d, { pool, flyerIndex: stage, focus, relics })),
    [draft.offer, pool, stage, focus, relics],
  );
  const best = grades.length >= 2 ? grades.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  const choose = (slot: number, id: string) => {
    const offer = [...draft.offer];
    if (slot < offer.length) offer[slot] = id;
    else offer.push(id);
    onOffer(offer);
  };

  // Dudes a flyer can offer: not Regular, not summons, not unlocked or on the Roster, not already in this flyer.
  const choices = useMemo(
    () =>
      dudes
        .filter((d) => !d.summon && !pool.includes(d.id) && !rosterTypes.includes(d.id))
        .filter((d) => choosing === null || !draft.offer.some((o, i) => o === d.id && i !== choosing))
        .map((d) => ({ id: d.id, name: d.name, icon: d.icon, desc: d.ability.desc })),
    [pool, rosterTypes, draft.offer, choosing],
  );

  const suggested = focus.length === 0 && pool.length > 1 ? suggestFocus(pool) : [];
  const slots = Array.from({ length: total }, (_, i) => i);

  let doneText = 'All flyers used. Keep tuning counts and order, or end the run.';
  if (index === 0) doneText = 'Your Roster already has 5 Dude Types, so there are no flyers this run.';

  return (
    <section className="panel run" aria-labelledby="run-title">
      <div className="run-head">
        <h2 id="run-title" className="panel-title">
          Run
        </h2>
        {total > 0 && (
          <ol className="timeline" aria-label="Flyers">
            {slots.map((i) => {
              const picked = decided[i]?.pick;
              const dude = picked ? dudeById.get(picked) : null;
              let state = '';
              if (i === index) state = 'current';
              else if (picked) state = 'done';
              return (
                <li key={i} className={state} title={dude ? `Flyer ${i + 1}: ${dude.name}` : `Flyer ${i + 1}`}>
                  <span className="tl-round">F{i + 1}</span>
                  {dude ? <Sprite id={dude.icon} size={28} alt={dude.name} /> : <span className="tl-empty" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        )}
        <div className="run-actions">
          <button className="btn small" onClick={onUndo} disabled={!flyers.length}>
            Undo
          </button>
          <button className="btn small ghost" onClick={onEnd}>
            End run
          </button>
        </div>
      </div>

      {suggested.length > 0 && (
        <p className="suggest-focus">
          Your team scales most with {suggested.map((c) => columnById.get(c)!.label).join(', ')}.{' '}
          <button className="link" onClick={() => onFocus(suggested)}>
            Use as focus stats
          </button>
        </p>
      )}

      {done ? (
        <p className="run-done">{doneText}</p>
      ) : (
        <div className="flyer">
          <h3>
            Flyer {index + 1} of {total}: {stageInfo.title}
          </h3>
          <p className="muted small">{stageInfo.hint}</p>
          <ul className="offers">
            {SLOTS.map((slot) => {
              const g = grades[slot];
              return (
                <li key={slot}>
                  {g ? (
                    <OfferCard
                      g={g}
                      best={best?.dude === g.dude}
                      onPick={() => onPick(g.dude)}
                      onChange={() => setChoosing(slot)}
                      onRemove={() => onOffer(draft.offer.filter((_, i) => i !== slot))}
                    />
                  ) : (
                    <button
                      className="offer-empty"
                      onClick={() => setChoosing(draft.offer.length)}
                      disabled={slot > draft.offer.length}
                    >
                      ＋ Add option {slot + 1}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ItemPicker
        key={`flyer-${choosing}`}
        open={choosing !== null}
        title="Which Dude does the flyer offer?"
        items={choices}
        selected={new Set(choosing !== null && draft.offer[choosing] ? [draft.offer[choosing]] : [])}
        multi={false}
        onPick={(id) => choosing !== null && choose(choosing, id)}
        onClose={() => setChoosing(null)}
      />
    </section>
  );
}

const GRADE_LABEL: Record<string, string> = { '++': 'Great pick', '+': 'Good pick', '0': 'Okay', '−': 'Weak pick' };
const GRADE_CLASS: Record<string, string> = { '++': 'g-great', '+': 'g-good', '0': 'g-ok', '−': 'g-weak' };

function reasonClass(delta: number) {
  if (delta > 0) return 'pro';
  if (delta < 0) return 'con';
  return 'note';
}

function reasonSign(delta: number) {
  if (delta > 0) return '+';
  if (delta < 0) return '−';
  return '•';
}

function OfferCard({
  g,
  best,
  onPick,
  onChange,
  onRemove,
}: Readonly<{ g: OptionGrade; best: boolean; onPick: () => void; onChange: () => void; onRemove: () => void }>) {
  const dude = dudeById.get(g.dude)!;
  return (
    <article className={`offer ${GRADE_CLASS[g.grade]}${best ? ' best' : ''}`}>
      {best && <span className="best-tag">Best pick</span>}
      <header className="offer-head">
        <Sprite id={dude.icon} size={44} />
        <div className="offer-id">
          <h4>{dude.name}</h4>
          <FamilyTag id={dude.family} />
        </div>
        <span className="grade" title={GRADE_LABEL[g.grade]}>
          {g.grade}
          <span className="sr-only"> {GRADE_LABEL[g.grade]}</span>
        </span>
      </header>
      <ul className="reasons">
        {g.reasons.map((r) => (
          <li key={r.text} className={reasonClass(r.delta)}>
            <span className="sign" aria-hidden="true">
              {reasonSign(r.delta)}
            </span>
            {r.text}
          </li>
        ))}
      </ul>
      <details className="offer-chart">
        <summary>Chart row</summary>
        <ChartLines dudeId={g.dude} />
      </details>
      <div className="offer-actions">
        <button className="btn primary" onClick={onPick}>
          Pick {dude.name.replace(/ ?Dude$/, '')}
        </button>
        <button className="btn small ghost" onClick={onChange}>
          Change
        </button>
        <button className="btn icon ghost danger" onClick={onRemove} aria-label={`Remove ${dude.name}`}>
          ✕
        </button>
      </div>
    </article>
  );
}
