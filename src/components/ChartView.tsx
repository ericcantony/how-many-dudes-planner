import { Fragment, useMemo, useState } from 'react';
import {
  CELL_LABELS,
  CHART_DUDES,
  COLUMN_BEST,
  COLUMNS,
  GRADE_LABELS,
  GROUP_ROWS,
  cellOf,
  familyOnly,
  gradeOf,
  selfScaling,
  scales,
  givesToTeam,
  type Column,
} from '../data/chart';
import { dudeById, families } from '../data/game';
import { CellLegend, Sprite } from './bits';

interface Props {
  focus: string[];
  counts: Map<string, number>;
  onToggleFocus: (col: string) => void;
  onAddDude: (id: string) => void;
}

/** Tooltip text for one cell: colour meaning, strength grade and the column's best total. */
function cellTitle(name: string, c: Column, rowKey: string) {
  const cell = cellOf(rowKey, c.id);
  const grade = gradeOf(rowKey, c.id);
  const fromFamily = familyOnly(rowKey, c.id);
  if (!cell && !grade) return undefined;
  const parts = [`${name}, ${c.label}`];
  if (cell) parts.push(CELL_LABELS[cell]);
  else if (fromFamily) parts.push('Only through his Family Relics');
  if (grade) parts.push(`Grade ${grade}: ${GRADE_LABELS[grade]} (best: ${COLUMN_BEST[c.id]})`);
  return parts.join('. ');
}

/** One chart cell: colour, plus the strength grade letter (grey italic when it comes only from Family Relics). */
function GradeCell({ rowKey, name, col, focused }: Readonly<{ rowKey: string; name: string; col: Column; focused: boolean }>) {
  const cell = cellOf(rowKey, col.id);
  const grade = gradeOf(rowKey, col.id);
  const classes = [];
  if (cell) classes.push(`cell-${cell}`);
  if (focused) classes.push('focused');
  const title = cellTitle(name, col, rowKey);
  return (
    <td className={classes.join(' ') || undefined} title={title}>
      {grade && <span className={familyOnly(rowKey, col.id) ? 'grade fam-only' : 'grade'}>{grade}</span>}
      {title && <span className="sr-only">{title}</span>}
    </td>
  );
}

/** The community synergy chart: Dudes × stats, grouped by Family. Click a column to focus it, a Dude to add him. */
export function ChartView({ focus, counts, onToggleFocus, onAddDude }: Readonly<Props>) {
  const [onlyMatching, setOnlyMatching] = useState(false);

  const groups = useMemo(
    () =>
      families.map((f) => ({
        family: f,
        dudes: CHART_DUDES.filter(
          (d) =>
            dudeById.get(d)?.family === f.id &&
            (!onlyMatching || !focus.length || focus.some((c) => givesToTeam(cellOf(d, c)) || scales(cellOf(d, c)))),
        ),
      })),
    [focus, onlyMatching],
  );

  return (
    <section className="panel chart-view" aria-labelledby="chart-title">
      <div className="chart-head">
        <div>
          <h2 id="chart-title" className="panel-title">
            Synergy chart
          </h2>
          <p className="muted small">
            Pick a Dude with many blue cells, then teammates with yellow or green in the same columns. Click a column to
            make it a focus stat; click a Dude to add him to your Roster.
          </p>
        </div>
        <label className="check">
          <input type="checkbox" checked={onlyMatching} onChange={(e) => setOnlyMatching(e.target.checked)} disabled={!focus.length} />
          Only Dudes with a focus stat
        </label>
      </div>
      <CellLegend />

      <div className="chart-scroll">
        <table className="chart">
          <thead>
            <tr>
              <th className="chart-corner" scope="col">
                Dude
              </th>
              <th scope="col" className="chart-col chart-blue" title="Self-scaling stats (blue cells)">
                <span>Blue</span>
              </th>
              {COLUMNS.map((c) => (
                <th key={c.id} scope="col" className={`chart-col group-${c.group}${focus.includes(c.id) ? ' focused' : ''}`}>
                  {c.group === 'enemy' ? (
                    <span title={c.label}>{c.short}</span>
                  ) : (
                    <button onClick={() => onToggleFocus(c.id)} aria-pressed={focus.includes(c.id)} title={`Focus on ${c.label}`}>
                      {c.short}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ family, dudes }) => (
              <Fragment key={family.id}>
                <tr className={`chart-family fam-${family.id}`}>
                  <th scope="row">
                    <span className="fam-th">
                      <Sprite id={family.icon} size={18} />
                      {family.name} Family
                    </span>
                  </th>
                  <td />
                  {COLUMNS.map((c) => (
                    <GradeCell key={c.id} rowKey={`family:${family.id}`} name={`${family.name} Family Relics`} col={c} focused={focus.includes(c.id)} />
                  ))}
                </tr>
                {dudes.map((d) => {
                  const dude = dudeById.get(d)!;
                  const n = counts.get(d) ?? 0;
                  return (
                    <tr key={d} className={n ? 'on-roster' : ''}>
                      <th scope="row">
                        <button className="chart-dude" onClick={() => onAddDude(d)} title={`Add ${dude.name}`}>
                          <Sprite id={dude.icon} size={22} />
                          {dude.name.replace(/ ?Dude$/, '')}
                          {n > 0 && <span className="badge inline">{n}</span>}
                        </button>
                      </th>
                      <td className="chart-blue-n">{selfScaling(d)}</td>
                      {COLUMNS.map((c) => (
                        <GradeCell key={c.id} rowKey={d} name={dude.name} col={c} focused={focus.includes(c.id)} />
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr className="chart-family">
              <th scope="row">Other</th>
              <td />
              {COLUMNS.map((c) => (
                <td key={c.id} className={focus.includes(c.id) ? 'focused' : undefined} />
              ))}
            </tr>
            <tr>
              <th scope="row">
                <span className="chart-dude static">
                  <Sprite id={dudeById.get('basic')!.icon} size={22} />
                  Regular
                </span>
              </th>
              <td className="chart-blue-n">{selfScaling('basic')}</td>
              {COLUMNS.map((c) => (
                <GradeCell key={c.id} rowKey="basic" name="Regular Dude" col={c} focused={focus.includes(c.id)} />
              ))}
            </tr>
            {GROUP_ROWS.map((g) => (
              <tr key={g.id}>
                <th scope="row">
                  <span className="chart-dude static">{g.name}</span>
                </th>
                <td />
                {COLUMNS.map((c) => (
                  <GradeCell key={c.id} rowKey={`group:${g.id}`} name={g.name} col={c} focused={focus.includes(c.id)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Chart and grades from a community post and spreadsheet on r/HowManyDudes (credited below; Dudex read 2026-11-06). Letters
        grade the stacked total (all his Relics, his Family’s and his ability, at 30 Dudes) against the best in the column: S
        best, then A to F. A grey letter on a white cell comes only from Family Relics. Summoned Dudes aren’t in it.
      </p>
    </section>
  );
}
