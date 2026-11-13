import { useState } from 'react';
import { dudeById } from '../data/game';
import { clampTarget } from '../lib/comp';
import { adviseRecruit, suggestTraining, type Advice, type RatioPlan } from '../lib/ratio';
import { Sprite } from './bits';

interface Props {
  plan: RatioPlan;
  onProjected: (n: number) => void;
  /** +1 copy of a type (a round pick). */
  onRecruit: (dude: string) => void;
  /** Move this many Regulars into a type (training event). */
  onTrain: (dude: string, n: number) => void;
  onAddRegulars: (n: number) => void;
  /** Targets set by hand, in percent. */
  targets: Record<string, number>;
  /** Set a type's target (null = back to automatic). */
  onTarget: (dude: string, pct: number | null) => void;
  onResetTargets: () => void;
}

type Mode = 'round' | 'train' | 'regulars';

const MODES: { id: Mode; label: string; need: number }[] = [
  { id: 'round', label: 'Round pick', need: 2 },
  { id: 'train', label: 'Training event', need: 3 },
  { id: 'regulars', label: 'Got Regulars', need: 0 },
];

const shortName = (d: string) => dudeById.get(d)?.name.replace(/ ?Dude$/, '') ?? d;
const plural = (n: number, word: string) => (n === 1 ? `1 ${word}` : `${n} ${word}s`);

/** In-run helper for the three moments that change counts: round picks, training events and free Regulars. */
export function RecruitHelper({
  plan,
  onProjected,
  onRecruit,
  onTrain,
  onAddRegulars,
  targets,
  onTarget,
  onResetTargets,
}: Readonly<Props>) {
  const [mode, setMode] = useState<Mode>('round');

  return (
    <section className="panel recruit-helper" aria-labelledby="recruit-helper-title">
      <div className="rh-head">
        <h2 id="recruit-helper-title" className="panel-title">
          Recruit plan
        </h2>
        <label className="rh-projected">
          <span>Expecting</span>
          <input
            className="input count"
            type="number"
            min={5}
            max={999}
            value={plan.projected}
            onChange={(e) => onProjected(Number(e.target.value) || plan.projected)}
          />
          <span>Dudes by the end, not counting Regulars</span>
        </label>
      </div>

      <TargetEditor plan={plan} targets={targets} onTarget={onTarget} onReset={onResetTargets} />

      {plan.warnings.length > 0 && (
        <ul className="rh-warnings">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <nav className="rh-modes" aria-label="What happened this round">
        {MODES.map((m) => (
          <button key={m.id} className="tab" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>

      {mode === 'regulars' ? (
        <RegularsPanel regulars={plan.regulars} onAdd={onAddRegulars} />
      ) : (
        <OfferPanel key={mode} mode={mode} plan={plan} onRecruit={onRecruit} onTrain={onTrain} />
      )}
    </section>
  );
}

/** Log Regulars the game hands out. */
function RegularsPanel({ regulars, onAdd }: Readonly<{ regulars: number; onAdd: (n: number) => void }>) {
  const [n, setN] = useState(1);
  return (
    <div className="rh-regulars">
      <p className="muted small">
        You have {plural(regulars, 'Regular')}. Log Regulars the game gives you here; train them into other types at a
        training event.
      </p>
      <label className="rh-amount">
        <span>Got</span>
        <input
          className="input count"
          type="number"
          min={1}
          max={999}
          value={n}
          onChange={(e) => setN(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
        />
        <span>Regular Dudes</span>
      </label>
      <button className="btn primary" onClick={() => onAdd(n)}>
        Add {plural(n, 'Regular')}
      </button>
    </div>
  );
}

/** Pick the offered types (2 for a round, 3 for a training event), then act on the advice. */
function OfferPanel({
  mode,
  plan,
  onRecruit,
  onTrain,
}: Readonly<{
  mode: 'round' | 'train';
  plan: RatioPlan;
  onRecruit: (dude: string) => void;
  onTrain: (dude: string, n: number) => void;
}>) {
  const [offer, setOffer] = useState<string[]>([]);
  const need = Math.min(MODES.find((m) => m.id === mode)!.need, plan.types.length);
  const advice = offer.length > 0 && offer.length >= need ? adviseRecruit(plan, offer) : null;

  const toggle = (d: string) =>
    setOffer((o) => {
      if (o.includes(d)) return o.filter((x) => x !== d);
      return o.length >= need ? [...o.slice(1), d] : [...o, d];
    });

  const what = need === 1 ? 'type' : `${need} types`;
  const instruction =
    mode === 'round'
      ? `Click the ${what} the game offers this round.`
      : `Click the ${what} the training event offers. You have ${plural(plan.regulars, 'Regular')} to train.`;

  return (
    <>
      <p className="muted small">{instruction}</p>
      <div className="rh-types">
        {plan.types.map((t) => (
          <button
            key={t.dude}
            className="rh-type"
            aria-pressed={offer.includes(t.dude)}
            onClick={() => toggle(t.dude)}
            title={dudeById.get(t.dude)!.name}
          >
            <Sprite id={dudeById.get(t.dude)!.icon} size={32} />
            <span>{shortName(t.dude)}</span>
          </button>
        ))}
      </div>
      {advice && (
        <ul className="rh-advice">
          {offer.map((d) => (
            <AdviceRow
              key={`${d}-${advice.pick}`}
              dude={d}
              advice={advice}
              mode={mode}
              plan={plan}
              onRecruit={(x) => {
                onRecruit(x);
                setOffer([]);
              }}
              onTrain={(x, n) => {
                onTrain(x, n);
                setOffer([]);
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** One offered type with its reason and the action button. The recommended one gets an editable amount when training. */
function AdviceRow({
  dude,
  advice,
  mode,
  plan,
  onRecruit,
  onTrain,
}: Readonly<{
  dude: string;
  advice: Advice;
  mode: 'round' | 'train';
  plan: RatioPlan;
  onRecruit: (dude: string) => void;
  onTrain: (dude: string, n: number) => void;
}>) {
  const best = dude === advice.pick;
  const [amount, setAmount] = useState(() => suggestTraining(plan, dude));
  const d = dudeById.get(dude)!;
  const btnClass = best ? 'btn primary' : 'btn';

  return (
    <li className={best ? 'best' : ''}>
      <Sprite id={d.icon} size={36} />
      <div className="rh-advice-text">
        <strong>{best ? `Take ${d.name}` : d.name}</strong>
        <span className="small">{advice.reasons.get(dude)}</span>
      </div>
      {mode === 'round' ? (
        <button className={btnClass} onClick={() => onRecruit(dude)}>
          +1 {shortName(dude)}
        </button>
      ) : (
        <div className="rh-train">
          {best && (
            <input
              className="input count"
              type="number"
              min={1}
              max={plan.regulars}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.min(plan.regulars, Number(e.target.value) || 1)))}
              aria-label="Regulars to train"
            />
          )}
          <button className={btnClass} disabled={plan.regulars === 0} onClick={() => onTrain(dude, amount)}>
            Train {amount}
          </button>
        </div>
      )}
    </li>
  );
}

/** Per-type target %, editable. Untouched types share whatever the hand-set ones leave. */
function TargetEditor({
  plan,
  targets,
  onTarget,
  onReset,
}: Readonly<{
  plan: RatioPlan;
  targets: Record<string, number>;
  onTarget: (dude: string, pct: number | null) => void;
  onReset: () => void;
}>) {
  const mine = plan.types.filter((t) => t.custom);
  const mineSum = mine.reduce((s, t) => s + (targets[t.dude] ?? 0), 0);
  const autoCount = plan.types.length - mine.length;
  const rest = Math.max(0, 100 - mineSum);

  let summary = 'All targets are automatic. Type a % to set your own.';
  if (mine.length && autoCount) summary = `You set ${mineSum}%. The other ${plural(autoCount, 'type')} share the remaining ${rest}%.`;
  else if (mine.length) summary = `You set every target (${mineSum}% in total).`;
  const heading = mine.length ? `Adjust targets (${mine.length} set by you)` : 'Adjust targets';

  return (
    <details className="rh-targets" open={mine.length > 0}>
      <summary>{heading}</summary>
      <ul>
        {plan.types.map((t) => {
          const dude = dudeById.get(t.dude)!;
          return (
            <li key={t.dude} className={t.custom ? 'custom' : ''}>
              <Sprite id={dude.icon} size={26} />
              <span className="rh-target-name">{dude.name}</span>
              <label className="rh-target-input">
                <input
                  className="input count"
                  type="number"
                  min={0}
                  max={100}
                  value={t.custom ? targets[t.dude] : t.sharePct}
                  onChange={(e) => onTarget(t.dude, clampTarget(Number(e.target.value) || 0))}
                  aria-label={`${dude.name} target percent`}
                />
                <span>%</span>
              </label>
              {t.custom ? (
                <button className="btn small ghost" onClick={() => onTarget(t.dude, null)} title={`Automatic would be ${t.autoPct}%`}>
                  Reset ({t.autoPct}%)
                </button>
              ) : (
                <span className="rh-auto">Auto</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="rh-targets-foot">
        <span className="muted small">{summary}</span>
        {mine.length > 0 && (
          <button className="btn small" onClick={onReset}>
            Reset all to automatic
          </button>
        )}
      </div>
    </details>
  );
}
