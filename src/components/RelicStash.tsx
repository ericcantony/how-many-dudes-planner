import { useMemo, useState } from 'react';
import { dudeById, familyById, relicById, relics } from '../data/game';
import type { Comp } from '../lib/comp';
import { gradeRelic, type RelicGrade } from '../lib/relicPick';
import { GradeBadge, Desc, Sprite } from './bits';
import { ItemPicker } from './ItemPicker';

interface Props {
  comp: Comp;
  /** Relics this Roster can use (for the picker's default filter). */
  relevant: Set<string>;
  /** Add the chosen Relic to Your Relics. */
  onTake: (relicId: string) => void;
}

const SLOTS = [0, 1, 2];

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

function scopeLabel(id: string) {
  const r = relicById.get(id)!;
  if (r.scope === 'family' && r.family) return `${familyById.get(r.family)?.name} Family`;
  if (r.scope === 'dude' && r.dudes) return r.dudes.map((d) => dudeById.get(d)?.name).join(', ');
  return 'Any team';
}

/** Relic stash event: enter the 3 offered Relics, see which helps your team most in combat. */
export function RelicStash({ comp, relevant, onTake }: Readonly<Props>) {
  const [offer, setOffer] = useState<string[]>([]);
  const [choosing, setChoosing] = useState<number | null>(null);

  const grades = useMemo(() => offer.map((id) => gradeRelic(id, comp)), [offer, comp]);
  const best = grades.length >= 2 ? grades.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  const choose = (slot: number, id: string) =>
    setOffer((o) => {
      const next = [...o];
      if (slot < next.length) next[slot] = id;
      else next.push(id);
      return next;
    });

  const items = useMemo(
    () => relics.filter((r) => choosing === null || !offer.some((o, i) => o === r.id && i !== choosing)),
    [offer, choosing],
  );

  return (
    <section className="panel relic-stash" aria-labelledby="relic-stash-title">
      <div className="rs-head">
        <h2 id="relic-stash-title" className="panel-title">
          Relic stash
        </h2>
        {offer.length > 0 && (
          <button className="btn small ghost" onClick={() => setOffer([])}>
            Clear
          </button>
        )}
      </div>
      <p className="muted small">
        When the game offers Relics to choose from, add them here. Each is graded for combat against your current Roster.
      </p>

      <ul className="offers">
        {SLOTS.map((slot) => {
          const g = grades[slot];
          return (
            <li key={slot}>
              {g ? (
                <RelicCard
                  g={g}
                  best={best?.relic === g.relic}
                  onTake={() => {
                    onTake(g.relic);
                    setOffer([]);
                  }}
                  onChange={() => setChoosing(slot)}
                  onRemove={() => setOffer((o) => o.filter((_, i) => i !== slot))}
                />
              ) : (
                <button className="offer-empty" onClick={() => setChoosing(offer.length)} disabled={slot > offer.length}>
                  ＋ Add Relic {slot + 1}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <ItemPicker
        key={`stash-${choosing}`}
        open={choosing !== null}
        title="Which Relic is offered?"
        items={items}
        selected={new Set(choosing !== null && offer[choosing] ? [offer[choosing]] : [])}
        relevant={relevant}
        multi={false}
        onPick={(id) => choosing !== null && choose(choosing, id)}
        onClose={() => setChoosing(null)}
      />
    </section>
  );
}

function RelicCard({
  g,
  best,
  onTake,
  onChange,
  onRemove,
}: Readonly<{ g: RelicGrade; best: boolean; onTake: () => void; onChange: () => void; onRemove: () => void }>) {
  const r = relicById.get(g.relic)!;
  return (
    <article className={`offer ${GRADE_CLASS[g.grade]}${best ? ' best' : ''}`}>
      {best && <span className="best-tag">Best pick</span>}
      <header className="offer-head">
        <Sprite id={r.icon} size={40} />
        <div className="offer-id">
          <h4>{r.name}</h4>
          <span className="item-scope">{scopeLabel(g.relic)}</span>
        </div>
        <GradeBadge grade={g.grade} score={g.score} />
      </header>
      <ul className="reasons">
        {g.reasons.map((x) => (
          <li key={x.text} className={reasonClass(x.delta)}>
            <span className="sign" aria-hidden="true">
              {reasonSign(x.delta)}
            </span>
            {x.text}
          </li>
        ))}
      </ul>
      <details className="offer-chart">
        <summary>What it does</summary>
        <p className="small">
          <Desc tokens={r.desc} />
        </p>
      </details>
      <div className="offer-actions">
        <button className="btn primary" onClick={onTake}>
          Take {r.name}
        </button>
        <button className="btn small ghost" onClick={onChange}>
          Change
        </button>
        <button className="btn icon ghost danger" onClick={onRemove} aria-label={`Remove ${r.name}`}>
          ✕
        </button>
      </div>
    </article>
  );
}
