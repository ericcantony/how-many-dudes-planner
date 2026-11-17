import type { ReactNode } from 'react';
import { dudeById, familyById } from '../data/game';
import { ROLE_LABELS, type Analysis as A, type Role } from '../lib/synergy';
import { Sprite, Tip } from './bits';
import { BuildAround } from './BuildAround';

interface Props {
  analysis: A;
  /** Team HP and DPS after defence, crits and Cleave (teamTotals), shown under the plain sums. */
  effective: { hp: number; dps: number };
  focus: string[];
  notes: string;
  onNotes: (s: string) => void;
  onToggleFocus: (col: string) => void;
  onFindRelics: (col: string) => void;
  onAddDude: (id: string) => void;
  /** Focus stats picked from a Dude, for the "Focus set from X" note. */
  autoFocus: { dude: string; cols: string[]; previous: string[] } | null;
  onUndoAutoFocus: () => void;
}

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

const HP_TIP = (
  <>
    <p className="tip-para">
      <strong>Team HP</strong> is the Max HP of all your Dudes added up.
    </p>
    <p className="tip-para">
      <strong>Effective</strong> is how much damage they can take: Max HP ÷ the share of damage that still lands after
      Toughness, Evasion and Block. Deflection counts half, since it sends half the hit to an ally. Healing isn’t counted.
    </p>
  </>
);
const DPS_TIP = (
  <>
    <p className="tip-para">
      <strong>Team DPS</strong> is Attack Power × Attack Speed of all your Dudes added up.
    </p>
    <p className="tip-para">
      <strong>Effective</strong> adds Crits (a crit deals the hit + 100% + Crit Damage), Cleave and Multistrike. The Relic, Trinket
      and Food stash grades use the effective numbers.
    </p>
  </>
);

/** "Effective 2,430" under a total, with a tooltip explaining it. */
function Effective({ value, tip }: Readonly<{ value: number; tip: ReactNode }>) {
  return (
    <Tip as="p" className="effective" content={tip}>
      Effective {fmt(value)}
    </Tip>
  );
}

export function AnalysisPanel({
  analysis: a,
  effective,
  focus,
  notes,
  onNotes,
  onToggleFocus,
  onFindRelics,
  onAddDude,
  autoFocus,
  onUndoAutoFocus,
}: Readonly<Props>) {
  const maxFam = Math.max(1, ...a.familyCounts.map((f) => f.dudes));

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
          <dt>Team HP</dt>
          <dd>{fmt(Math.round(a.totalHp))}</dd>
          <Effective value={Math.round(effective.hp)} tip={HP_TIP} />
        </div>
        <div>
          <dt>Team DPS</dt>
          <dd>{fmt(a.totalDps)}</dd>
          <Effective value={effective.dps} tip={DPS_TIP} />
        </div>
      </dl>
      <p className="muted small">
        Includes your Relics, Trinkets, meals and Roster bonuses we can work out. In-battle effects aren’t counted.
      </p>

      <BuildAround
        analysis={a}
        focus={focus}
        onToggleFocus={onToggleFocus}
        onFindRelics={onFindRelics}
        onAddDude={onAddDude}
        autoFocus={autoFocus}
        onUndoAutoFocus={onUndoAutoFocus}
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
