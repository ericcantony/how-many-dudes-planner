import { CHART_DUDES, cellOf, columnById, FOCUS_COLUMNS, givesToTeam, gradeOf, type ColGroup } from '../data/chart';
import { dudeById, familyById, relicById } from '../data/game';
import type { Analysis, FocusLine } from '../lib/synergy';
import { CellLegend, ColChip, Sprite, StatIcon } from './bits';

/** Team healers graded S or A for Healing (HP/s per Dude) in the chart spreadsheet. */
const TOP_HEALERS = CHART_DUDES.filter((d) => givesToTeam(cellOf(d, 'heal')) && ['S', 'A'].includes(gradeOf(d, 'heal') ?? ''))
  .map((d) => `${dudeById.get(d)!.name} (${gradeOf(d, 'heal')})`)
  .join(', ');

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

function DudeIcons({ ids, col, onAdd }: Readonly<{ ids: string[]; col?: string; onAdd?: (id: string) => void }>) {
  return (
    <span className="lineup-suggest">
      {ids.slice(0, MAX_SUGGESTIONS).map((d) => {
        const dude = dudeById.get(d)!;
        const cell = col ? cellOf(d, col) : undefined;
        const icon = <Sprite id={dude.icon} size={22} alt={onAdd ? `Add ${dude.name}` : dude.name} />;
        return onAdd ? (
          <button key={d} className={`mini-dude${cell ? ` ring-${cell}` : ''}`} onClick={() => onAdd(d)} title={`Add ${dude.name}`}>
            {icon}
          </button>
        ) : (
          <span key={d} className={`mini-dude static${cell ? ` ring-${cell}` : ''}`} title={dude.name}>
            {icon}
          </span>
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
        <p className="lineup-givers">Given by {givenBy.join(', ')}</p>
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

      <div className={`healer ${a.healer.healers.length ? 'fed' : 'unfed'}`}>
        {a.healer.healers.length ? (
          <p>
            <strong>Healer:</strong> {a.healer.healers.map((d) => dudeById.get(d)!.name).join(', ')}
          </p>
        ) : (
          <>
            <p>
              <strong>No healer yet.</strong> Add a Dude who heals other Dude Types.
            </p>
            <DudeIcons ids={a.healer.suggestions} col="heal" onAdd={onAddDude} />
          </>
        )}
        <p className="muted small">
          Strongest healers in the chart (Healing graded as HP/s per Dude): {TOP_HEALERS}.
        </p>
      </div>

      <details className="legend-box">
        <summary>Colour key</summary>
        <CellLegend />
        <p className="muted small">From the synergy chart and spreadsheet by u/esmgcito on r/HowManyDudes.</p>
      </details>
    </section>
  );
}
