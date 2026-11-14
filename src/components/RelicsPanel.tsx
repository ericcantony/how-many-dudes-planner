import { relicById } from '../data/game';
import type { TeamSynergy } from '../lib/synergy';
import { Desc, Sprite } from './bits';

interface Props {
  /** Relic ids on this comp. */
  relics: string[];
  /** Relics no Dude on the Roster can use. */
  unusable: Set<string>;
  /** Team-wide Relic payoffs for the current Roster (Bonfire, Championship Belt…). */
  payoffs: TeamSynergy[];
  onToggle: (id: string) => void;
  onOpenPicker: () => void;
}

/** Every Relic in one place: the ones you have or want, and the team-wide payoffs worth looking for. */
export function RelicsPanel({ relics, unusable, payoffs, onToggle, onOpenPicker }: Readonly<Props>) {
  return (
    <section className="panel relics-panel" aria-labelledby="relics-title">
      <div className="section-head">
        <h2 id="relics-title" className="panel-title">
          Your Relics ({relics.length})
        </h2>
        <button className="btn small" onClick={onOpenPicker}>
          Add Relics
        </button>
      </div>
      <p className="muted small">
        Relics here count toward the Roster stats and the grades. Add the ones you have, or the ones you’re looking for in
        the shop.
      </p>
      {relics.length === 0 ? (
        <p className="muted small">No Relics yet.</p>
      ) : (
        <ul className="planned">
          {relics.map((id) => {
            const r = relicById.get(id)!;
            const noUse = unusable.has(id);
            return (
              <li key={id} className={noUse ? 'unusable' : ''}>
                <Sprite id={r.icon} size={32} />
                <div>
                  <strong>{r.name}</strong>
                  {noUse && <span className="warn-tag">No Dude on the Roster uses this</span>}
                  <p>
                    <Desc tokens={r.desc} />
                  </p>
                </div>
                <button className="btn icon ghost danger" onClick={() => onToggle(id)} aria-label={`Remove ${r.name}`}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {payoffs.length > 0 && (
        <>
          <h3>Team Relic payoffs</h3>
          <p className="muted small">What these Relics would give your current Roster.</p>
          <ul className="team-syn">
            {payoffs.map((s) => (
              <li key={s.id} className={s.planned ? 'on' : ''}>
                {s.icon && <Sprite id={s.icon} size={28} />}
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                </div>
                <button className="btn small" aria-pressed={s.planned} onClick={() => onToggle(s.id)}>
                  {s.planned ? 'Added' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
