import { Fragment, useMemo, useState } from 'react';
import { CELL_LABELS, CHART_DUDES, COLUMNS, cellOf, familyCells, selfScaling, scales, givesToTeam } from '../data/chart';
import { dudeById, families } from '../data/game';
import { CellLegend, Sprite } from './bits';

interface Props {
  focus: string[];
  counts: Map<string, number>;
  onToggleFocus: (col: string) => void;
  onAddDude: (id: string) => void;
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
                  {COLUMNS.map((c) => {
                    const cell = familyCells(family.id)?.get(c.id);
                    return (
                      <td
                        key={c.id}
                        className={`${cell ? `cell-${cell}` : ''}${focus.includes(c.id) ? ' focused' : ''}`}
                        title={cell ? `${family.name} Family Relics, ${c.label}: ${CELL_LABELS[cell]}` : undefined}
                      />
                    );
                  })}
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
                      {COLUMNS.map((c) => {
                        const cell = cellOf(d, c.id);
                        return (
                          <td
                            key={c.id}
                            className={`${cell ? `cell-${cell}` : ''}${focus.includes(c.id) ? ' focused' : ''}`}
                            title={cell ? `${dude.name}, ${c.label}: ${CELL_LABELS[cell]}` : undefined}
                          >
                            {cell && <span className="sr-only">{CELL_LABELS[cell]}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Chart transcribed from a community post on r/HowManyDudes (credited below). Regular Dude and summoned Dudes aren’t in it.
      </p>
    </section>
  );
}
