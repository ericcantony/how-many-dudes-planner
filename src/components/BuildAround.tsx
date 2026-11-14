import { cellOf, columnById, FOCUS_COLUMNS, givesToTeam, type ColGroup } from '../data/chart';
import { dudeById, familyById, relicById } from '../data/game';
import type { Analysis, FocusLine, TeamPick } from '../lib/synergy';
import { CellDetail, CellLegend, ColChip, Sprite, StatIcon, Tip } from './bits';

interface Props {
  analysis: Analysis;
  focus: string[];
  onToggleFocus: (col: string) => void;
  onFindRelics: (col: string) => void;
  onAddDude: (id: string) => void;
}

const GROUPS: { id: ColGroup; label: string }[] = [
  { id: 'offense', label: 'Attack' },
  { id: 'defense', label: 'Defence' },
  { id: 'support', label: 'Support' },
];

const MAX_SUGGESTIONS = 6;

/** Tooltip for a suggested Dude: who he is, why (the chart cells behind the pick), and what a click does. */
function DudeTip({ dude, cols, add }: Readonly<{ dude: string; cols: string[]; add: boolean }>) {
  const d = dudeById.get(dude)!;
  return (
    <>
      <span className="tip-title">
        <Sprite id={d.icon} size={20} />
        {d.name}
      </span>
      {cols.map((col) => (
        <CellDetail key={col} dude={dude} col={col} />
      ))}
      {add && <span className="tip-note">Click to add him to your Roster.</span>}
    </>
  );
}

function DudeIcons({ ids, col, onAdd }: Readonly<{ ids: string[]; col?: string; onAdd?: (id: string) => void }>) {
  return (
    <span className="lineup-suggest">
      {ids.slice(0, MAX_SUGGESTIONS).map((d) => {
        const dude = dudeById.get(d)!;
        const cell = col ? cellOf(d, col) : undefined;
        const ring = cell ? ` ring-${cell}` : '';
        const icon = <Sprite id={dude.icon} size={22} alt={onAdd ? `Add ${dude.name}` : dude.name} />;
        const tip = <DudeTip dude={d} cols={col ? [col] : []} add={!!onAdd} />;
        return onAdd ? (
          <Tip key={d} content={tip} focusable={false}>
            <button className={`mini-dude${ring}`} onClick={() => onAdd(d)}>
              {icon}
            </button>
          </Tip>
        ) : (
          <Tip key={d} content={tip} className={`mini-dude static${ring}`}>
            {icon}
          </Tip>
        );
      })}
    </span>
  );
}

function Line({ l, onAddDude, onFindRelics }: Readonly<{ l: FocusLine; onAddDude: (id: string) => void; onFindRelics: (col: string) => void }>) {
  const col = columnById.get(l.col)!;
  const hasGivers = l.givers.length + l.families.length + l.relics.length > 0;
  const givenBy = [
    ...l.givers.map((g) => dudeById.get(g.dude)!.name),
    ...l.families.map((f) => `${familyById.get(f)!.name} Family Relics`),
    ...l.relics.map((r) => relicById.get(r)!.name),
  ];
  return (
    <li className={hasGivers && l.scalers.length ? 'fed' : 'unfed'}>
      <div className="lineup-head">
        <ColChip col={l.col} />
        {l.scalers.length > 0 && (
          <span className="lineup-users">
            <span className="muted small">Scales</span>
            <DudeIcons ids={l.scalers.map((s) => s.dude)} col={l.col} />
          </span>
        )}
      </div>
      {l.scalers.length === 0 && (
        <div className="lineup-fix">
          <span>No one on your Roster scales with {col.label}.</span>
          {l.anchors.length > 0 && (
            <span className="lineup-suggest">
              Add <DudeIcons ids={l.anchors} col={l.col} onAdd={onAddDude} />
            </span>
          )}
        </div>
      )}
      {hasGivers ? (
        <>
          <p className="lineup-givers">Given by {givenBy.join(', ')}</p>
          {l.suggestions.length > 0 && (
            <div className="lineup-more">
              <span className="muted small">Also from</span>
              <DudeIcons ids={l.suggestions} col={l.col} onAdd={onAddDude} />
            </div>
          )}
        </>
      ) : (
        <div className="lineup-fix">
          <span>Nothing gives {col.label} to the team.</span>
          {l.suggestions.length > 0 && (
            <span className="lineup-suggest">
              Add <DudeIcons ids={l.suggestions} col={l.col} onAdd={onAddDude} />
            </span>
          )}
          {col.relicTerm || l.col === 'heal' ? (
            <button className="link" onClick={() => onFindRelics(l.col)}>
              Find {col.label} Relics
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}

/** Ranked teammates for the open Roster slots, each with why he fits. */
/** The chart cells behind a pick: his focus-stat cells, plus Healing when he heals the team. */
const pickCols = (dude: string, focus: string[]) => [
  ...focus.filter((col) => cellOf(dude, col)),
  ...(givesToTeam(cellOf(dude, 'heal')) && !focus.includes('heal') ? ['heal'] : []),
];

function FillTeam({
  picks,
  open,
  focus,
  onAddDude,
}: Readonly<{ picks: TeamPick[]; open: number; focus: string[]; onAddDude: (id: string) => void }>) {
  return (
    <div className="fill-team">
      <h4>
        Fill your team <span className="muted small">{open === 1 ? '1 open slot' : `${open} open slots`}</span>
      </h4>
      <ol>
        {picks.map((p) => {
          const dude = dudeById.get(p.dude)!;
          return (
            <li key={p.dude}>
              <Tip content={<DudeTip dude={p.dude} cols={pickCols(p.dude, focus)} add />} focusable={false} className="fill-tip">
                <button className="fill-pick" onClick={() => onAddDude(p.dude)}>
                  <Sprite id={dude.icon} size={26} />
                  <span>
                    <strong>{dude.name}</strong>
                    <span className="muted small">{p.reasons.join(' · ')}</span>
                  </span>
                </button>
              </Tip>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BuildAround({ analysis: a, focus, onToggleFocus, onFindRelics, onAddDude }: Readonly<Props>) {
  return (
    <section className="build" aria-labelledby="build-title">
      <h3 id="build-title">Build around</h3>
      <p className="muted small">
        Pick 1–2 attack stats and 1–2 defence stats. Then add a Dude who scales with them (blue), and teammates who give
        them to others (yellow is best, then green).
      </p>
      {GROUPS.map((g) => (
        <fieldset key={g.id} className="focus-group" aria-label={`${g.label} stats`}>
          <span className="focus-label">{g.label}</span>
          {FOCUS_COLUMNS.filter((c) => c.group === g.id).map((c) => (
            <button key={c.id} className="focus-btn" aria-pressed={focus.includes(c.id)} onClick={() => onToggleFocus(c.id)}>
              {c.icon && <StatIcon id={c.icon} size={14} />}
              {c.short}
            </button>
          ))}
        </fieldset>
      ))}

      {focus.length > 0 && (
        <ul className="lineup">
          {a.focusLines.map((l) => (
            <Line key={l.col} l={l} onAddDude={onAddDude} onFindRelics={onFindRelics} />
          ))}
        </ul>
      )}

      {a.fill.length > 0 && <FillTeam picks={a.fill} open={a.openSlots} focus={focus} onAddDude={onAddDude} />}

      <div className={`healer ${a.healer.healers.length ? 'fed' : 'unfed'}`}>
        {a.healer.healers.length ? (
          <p>
            <strong>Healer:</strong> {a.healer.healers.map((d) => dudeById.get(d)!.name).join(', ')}
          </p>
        ) : (
          <>
            <p>
              <strong>No healer yet.</strong> Add a Dude who heals other Dude Types
              {focus.length ? ' (the ones that also give your focus stats come first)' : ''}.
            </p>
            <DudeIcons ids={a.healer.suggestions} col="heal" onAdd={onAddDude} />
          </>
        )}
      </div>

      <details className="legend-box">
        <summary>Colour key</summary>
        <CellLegend />
        <p className="muted small">Colours from the synergy chart by u/esmgcito on r/HowManyDudes; grades are our estimates from the Dudex.</p>
      </details>
    </section>
  );
}
