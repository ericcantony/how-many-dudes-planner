import { dudeById, familyById, relicById } from '../data/game';
import { ROLE_LABELS, type Analysis as A, type Role } from '../lib/synergy';
import { Desc, Sprite } from './bits';
import { BuildAround } from './BuildAround';

interface Props {
  analysis: A;
  plannedRelics: string[];
  focus: string[];
  notes: string;
  onNotes: (s: string) => void;
  onToggleRelic: (id: string) => void;
  onToggleFocus: (col: string) => void;
  onOpenRelics: () => void;
  onFindRelics: (col: string) => void;
  onAddDude: (id: string) => void;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

export function AnalysisPanel({
  analysis: a,
  plannedRelics,
  focus,
  notes,
  onNotes,
  onToggleRelic,
  onToggleFocus,
  onOpenRelics,
  onFindRelics,
  onAddDude,
}: Readonly<Props>) {
  const maxFam = Math.max(1, ...a.familyCounts.map((f) => f.dudes));
  const unusable = plannedRelics.filter((id) => !a.relevantRelics.has(id));

  return (
    <aside className="panel analysis" aria-labelledby="analysis-title">
      <h2 id="analysis-title" className="panel-title">
        Breakdown
      </h2>

      <dl className="totals">
        <div>
          <dt>Dudes</dt>
          <dd>{a.totalDudes}</dd>
        </div>
        <div>
          <dt>Base HP</dt>
          <dd>{fmt(a.totalHp)}</dd>
        </div>
        <div>
          <dt>Base DPS</dt>
          <dd>{fmt(a.totalDps)}</dd>
        </div>
      </dl>
      <p className="muted small">Totals use base stats, before Relics, Trinkets and battle buffs.</p>

      <BuildAround
        analysis={a}
        focus={focus}
        onToggleFocus={onToggleFocus}
        onFindRelics={onFindRelics}
        onAddDude={onAddDude}
      />

      <h3>Families</h3>
      <ul className="fam-bars">
        {a.familyCounts.map((f) => {
          const fam = familyById.get(f.id)!;
          return (
            <li key={f.id} className={`fam-${f.id}${f.dudes ? '' : ' zero'}`}>
              <Sprite id={fam.icon} size={20} />
              <span className="fam-name">{fam.name}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${(f.dudes / maxFam) * 100}%` }} />
              </span>
              <span className="fam-n">
                {f.dudes}
                {f.types > 1 && <span className="muted"> in {f.types} types</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <h3>Roles</h3>
      <ul className="roles">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <li key={r} className={a.roles[r].length ? '' : 'zero'}>
            <span>{ROLE_LABELS[r]}</span>
            <span className="role-dudes">
              {a.roles[r].length
                ? a.roles[r].map((d) => <Sprite key={d} id={dudeById.get(d)!.icon} size={22} alt={dudeById.get(d)!.name} />)
                : <span className="muted">None</span>}
            </span>
          </li>
        ))}
      </ul>

      {a.teamSynergies.length > 0 && (
        <>
          <h3>Team Relic payoffs</h3>
          <ul className="team-syn">
            {a.teamSynergies.map((s) => (
              <li key={s.id} className={s.planned ? 'on' : ''}>
                {s.icon && <Sprite id={s.icon} size={28} />}
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                </div>
                <button className="btn small" aria-pressed={s.planned} onClick={() => onToggleRelic(s.id)}>
                  {s.planned ? 'Planned' : 'Plan'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="section-head">
        <h3>Planned Relics ({plannedRelics.length})</h3>
        <button className="btn small" onClick={onOpenRelics}>
          Add Relics
        </button>
      </div>
      {plannedRelics.length === 0 ? (
        <p className="muted small">No Relics planned yet. Add the ones you want to look for in the shop.</p>
      ) : (
        <ul className="planned">
          {plannedRelics.map((id) => {
            const r = relicById.get(id)!;
            return (
              <li key={id} className={unusable.includes(id) ? 'unusable' : ''}>
                <Sprite id={r.icon} size={32} />
                <div>
                  <strong>{r.name}</strong>
                  {unusable.includes(id) && <span className="warn-tag">No Dude on the Roster uses this</span>}
                  <p>
                    <Desc tokens={r.desc} />
                  </p>
                </div>
                <button className="btn icon ghost danger" onClick={() => onToggleRelic(id)} aria-label={`Remove ${r.name}`}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h3>
        <label htmlFor="comp-notes">Notes</label>
      </h3>
      <textarea
        id="comp-notes"
        className="input notes"
        rows={4}
        placeholder="Game plan, shop priorities, what to swap late"
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
      />
    </aside>
  );
}
