import { useMemo, useState } from 'react';
import { dudeById, trinketById, trinkets, type Token } from '../data/game';
import { TRINKET_GIVES } from '../data/chart';
import { FOOD_GIVES, FOOD_ITEMS, foodItemById } from '../data/food';
import type { Comp } from '../lib/comp';
import { GRADE_CLASS } from '../lib/relicPick';
import { gradeTrinket, type HoldGrade } from '../lib/trinketPick';
import { gradeFood } from '../lib/foodPick';
import { GradeBadge, Desc, Sprite } from './bits';
import { ItemPicker, type PickItem } from './ItemPicker';
import { ReasonList, SecondStatSelect } from './stashBits';

/** One offered item; `second` is a meal's random second stat once you know it. */
interface Offer {
  id: string;
  second: string | null;
}

/** What differs between the Trinket and Food stash. */
interface Kind {
  id: string;
  title: string;
  /** "Trinket" / "meal", for buttons and labels. */
  noun: string;
  intro: string;
  /** Shown under the intro, e.g. why meals aren't measured. */
  note?: string;
  items: PickItem[];
  gives: Map<string, string[]>;
  lookup: (id: string) => { name: string; icon: string; desc: Token[] } | undefined;
  grade: (offer: Offer, comp: Comp) => HoldGrade;
  /** Meals only: the random second stat can be entered. */
  hasSecond?: boolean;
}

const TRINKET: Kind = {
  id: 'trinket',
  title: 'Trinket stash',
  noun: 'Trinket',
  intro:
    'When the game offers Trinkets to choose from, add them here. Each is graded on every Dude Type of your Roster, and the best one to hold it is picked for you.',
  items: trinkets,
  gives: TRINKET_GIVES,
  lookup: (id) => trinketById.get(id),
  grade: (o, comp) => gradeTrinket(o.id, comp),
};

const FOOD: Kind = {
  id: 'food',
  title: 'Food stash',
  noun: 'meal',
  intro:
    'When the game offers meals (Food) to choose from, add them here. Each is graded on every Dude Type of your Roster, and the best one to eat it is picked for you.',
  note: 'Meal amounts aren’t in the Dudex; they come from a player’s guide (first stat fixed per meal, second stat random). Pick the second stat when you see it.',
  items: FOOD_ITEMS,
  gives: FOOD_GIVES,
  lookup: (id) => foodItemById.get(id),
  grade: (o, comp) => gradeFood(o.id, o.second, comp),
  hasSecond: true,
};

interface Props {
  comp: Comp;
  /** Give the chosen item to a Roster entry (replacing what it had). */
  onTake: (id: string, entryKey: string, second: string | null) => void;
}

export const TrinketStash = (p: Readonly<Props>) => <HolderStash kind={TRINKET} {...p} />;
export const FoodStash = (p: Readonly<Props>) => <HolderStash kind={FOOD} {...p} />;

const SLOTS = [0, 1, 2];

/**
 * Stash event for things one Dude Type holds (Trinkets, meals): enter the 3 offered items.
 * Each is graded on every Dude Type of the Roster, and the card shows the best holder (you can pick another).
 */
function HolderStash({ kind, comp, onTake }: Readonly<Props & { kind: Kind }>) {
  const [offer, setOffer] = useState<Offer[]>([]);
  const [choosing, setChoosing] = useState<number | null>(null);

  const grades = useMemo(() => offer.map((o) => kind.grade(o, comp)), [offer, comp, kind]);
  const top = (g: HoldGrade) => g.holders[0]?.score ?? -Infinity;
  const best = grades.length >= 2 ? grades.reduce((a, b) => (top(b) > top(a) ? b : a), grades[0]) : null;

  const choose = (slot: number, id: string) =>
    setOffer((o) => {
      const next = [...o];
      if (slot < next.length) next[slot] = { id, second: null };
      else next.push({ id, second: null });
      return next;
    });
  const setSecond = (slot: number, second: string | null) =>
    setOffer((o) => o.map((x, i) => (i === slot ? { ...x, second } : x)));

  const items = useMemo(
    () => kind.items.filter((t) => choosing === null || !offer.some((o, i) => o.id === t.id && i !== choosing)),
    [kind, offer, choosing],
  );
  const titleId = `${kind.id}-stash-title`;

  return (
    <section className="panel relic-stash" aria-labelledby={titleId}>
      <div className="rs-head">
        <h2 id={titleId} className="panel-title">
          {kind.title}
        </h2>
        {offer.length > 0 && (
          <button className="btn small ghost" onClick={() => setOffer([])}>
            Clear
          </button>
        )}
      </div>
      <p className="muted small">{kind.intro}</p>
      {kind.note && <p className="muted small">{kind.note}</p>}

      <ul className="offers">
        {SLOTS.map((slot) => {
          const g = grades[slot];
          const o = offer[slot];
          return (
            <li key={slot}>
              {g && o ? (
                <HolderCard
                  key={g.item}
                  kind={kind}
                  g={g}
                  second={o.second}
                  best={best?.item === g.item}
                  onSecond={(s) => setSecond(slot, s)}
                  onTake={(entryKey) => {
                    onTake(g.item, entryKey, o.second);
                    setOffer([]);
                  }}
                  onChange={() => setChoosing(slot)}
                  onRemove={() => setOffer((list) => list.filter((_, i) => i !== slot))}
                />
              ) : (
                <button className="offer-empty" onClick={() => setChoosing(offer.length)} disabled={slot > offer.length}>
                  ＋ Add {kind.noun} {slot + 1}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <ItemPicker
        key={`${kind.id}-stash-${choosing}`}
        open={choosing !== null}
        title={`Which ${kind.noun} is offered?`}
        items={items}
        selected={new Set(choosing !== null && offer[choosing] ? [offer[choosing].id] : [])}
        gives={kind.gives}
        multi={false}
        onPick={(id) => choosing !== null && choose(choosing, id)}
        onClose={() => setChoosing(null)}
      />
    </section>
  );
}

interface CardProps {
  kind: Kind;
  g: HoldGrade;
  second: string | null;
  best: boolean;
  onSecond: (second: string | null) => void;
  onTake: (entryKey: string) => void;
  onChange: () => void;
  onRemove: () => void;
}

function HolderCard({ kind, g, second, best, onSecond, onTake, onChange, onRemove }: Readonly<CardProps>) {
  const item = kind.lookup(g.item)!;
  const [holderKey, setHolderKey] = useState<string | null>(null);
  const holder = g.holders.find((h) => h.key === holderKey) ?? g.holders[0];
  if (!holder) return null;
  const name = dudeById.get(holder.dude)?.name ?? holder.dude;
  const isBest = holder.key === g.holders[0].key;
  return (
    <article className={`offer ${GRADE_CLASS[holder.grade]}${best ? ' best' : ''}`}>
      {best && <span className="best-tag">Best pick</span>}
      <header className="offer-head">
        <Sprite id={item.icon} size={40} />
        <div className="offer-id">
          <h4>{item.name}</h4>
          <span className="item-scope">{isBest ? `Best on ${name}` : `On ${name}`}</span>
        </div>
        <GradeBadge grade={holder.grade} score={holder.score} />
      </header>
      {kind.hasSecond && (
        <label className="holder-pick small">
          Second stat{' '}
          <SecondStatSelect foodId={g.item} value={second} emptyLabel="Not known yet" onChange={onSecond} />
        </label>
      )}
      {g.holders.length > 1 && (
        <label className="holder-pick small">
          Give it to{' '}
          <select value={holder.key} onChange={(e) => setHolderKey(e.target.value)}>
            {g.holders.map((h, i) => (
              <option key={h.key} value={h.key}>
                {dudeById.get(h.dude)?.name ?? h.dude} ({h.grade}){i === 0 ? ', best' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <ReasonList reasons={holder.reasons} />
      <details className="offer-chart">
        <summary>What it does</summary>
        <p className="small">
          <Desc tokens={item.desc} />
        </p>
      </details>
      <div className="offer-actions">
        <button className="btn primary" onClick={() => onTake(holder.key)}>
          Give to {name}
        </button>
        <button className="btn small ghost" onClick={onChange}>
          Change
        </button>
        <button className="btn icon ghost danger" onClick={onRemove} aria-label={`Remove ${item.name}`}>
          ✕
        </button>
      </div>
    </article>
  );
}
