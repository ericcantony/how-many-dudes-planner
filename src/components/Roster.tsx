import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dudeById, relicById, trinketById, wikiUrl } from '../data/game';
import { countedTypes, MAX_TYPES, type Entry } from '../lib/comp';
import type { RatioPlan, TypeTarget } from '../lib/ratio';
import type { Analysis, Link } from '../lib/synergy';
import { cellOf, gradeOf } from '../data/chart';
import { ChartLines, ColChip, Desc, FamilyTag, Sprite, StatIcon, Tip } from './bits';
import type { EntryStats, ShownStat } from '../lib/stats';

interface Props {
  roster: Entry[];
  plannedRelics: Set<string>;
  plan: RatioPlan;
  stats: Map<string, EntryStats>;
  focus: string[];
  analysis: Analysis;
  onChange: (roster: Entry[]) => void;
  onToggleRelic: (id: string) => void;
  onPickTrinket: (entryKey: string) => void;
}

const wide = { gutter: 60, lane: 14 };
const narrow = { gutter: 38, lane: 9 };
const NARROW_QUERY = '(max-width: 760px)';

function useGutter() {
  const [isNarrow, setNarrow] = useState(() => matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return isNarrow ? narrow : wide;
}

export function Roster({ roster, plan, stats, plannedRelics, focus, analysis, onChange, onToggleRelic, onPickTrinket }: Readonly<Props>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const gutter = useGutter();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const [rows, setRows] = useState<{ top: number; height: number }[]>([]);

  // Measure row positions so the wires in the gutter line up with them.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () =>
      setRows(
        [...el.children].map((c) => ({
          top: (c as HTMLElement).offsetTop,
          height: (c as HTMLElement).offsetHeight,
        })),
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    return () => ro.disconnect();
  }, [roster, open]);

  const update = (key: string, patch: Partial<Entry>) =>
    onChange(roster.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= roster.length) return;
    onChange(arrayMove(roster, from, to));
  };

  const onDragEnd = (ev: DragEndEvent) => {
    setDragging(false);
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = roster.findIndex((e) => e.key === active.id);
    const to = roster.findIndex((e) => e.key === over.id);
    move(from, to);
  };

  if (!roster.length) {
    return (
      <section className="panel roster" aria-labelledby="roster-title">
        <h2 id="roster-title" className="panel-title">
          Roster
        </h2>
        <div className="roster-empty">
          <p>Your Roster is empty. Pick Dudes from Recruit to add them.</p>
          <p className="muted">
            Order matters: the top of the list is the top of your in-game Roster. Some Dudes affect the Dude Type
            directly above or below them, and the lines on the left show those links.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel roster" aria-labelledby="roster-title">
      <div className="roster-head">
        <h2 id="roster-title" className="panel-title">
          Roster
        </h2>
        <p className="muted">
          Drag to reorder. Top of the list is the top of your Roster. Green stats include your Relics and Trinkets;
          hover or focus a stat for details.
        </p>
        <TypeCounter roster={roster} />
      </div>
      <div className="roster-body" style={{ paddingLeft: gutter.gutter }}>
        {!dragging && <Wires links={analysis.links} rows={rows} gutter={gutter.gutter} laneW={gutter.lane} />}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => setDragging(true)}
          onDragCancel={() => setDragging(false)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={roster.map((e) => e.key)} strategy={verticalListSortingStrategy}>
            <ol className="roster-list" ref={listRef}>
              {roster.map((e, i) => (
                <Row
                  key={e.key}
                  entry={e}
                  index={i}
                  total={roster.length}
                  expanded={open.has(e.key)}
                  links={analysis.links}
                  roster={roster}
                  notes={analysis.notes.get(e.key) ?? []}
                  focus={focus}
                  target={plan.types.find((t) => t.dude === e.dude) ?? null}
                  projected={plan.projected}
                  recruited={plan.total}
                  stats={stats.get(e.key) ?? null}
                  plannedRelics={plannedRelics}
                  onToggle={() =>
                    setOpen((s) => {
                      const n = new Set(s);
                      if (n.has(e.key)) n.delete(e.key);
                      else n.add(e.key);
                      return n;
                    })
                  }
                  onCount={(count) => update(e.key, { count })}
                  onRemove={() => onChange(roster.filter((x) => x.key !== e.key))}
                  onMove={(d) => move(i, i + d)}
                  onToggleRelic={onToggleRelic}
                  onPickTrinket={() => onPickTrinket(e.key)}
                  onClearTrinket={() => update(e.key, { trinket: null })}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "Target 35% (35 of 100), now 9 (30%)" with a bar: current share against target share. */
function RatioLine({
  dude,
  target,
  projected,
  recruited,
}: Readonly<{ dude: string; target: TypeTarget | null; projected: number; recruited: number }>) {
  if (dude === 'basic') return <p className="ratio-line muted">Regulars: not part of the ratio, waiting to be trained</p>;
  if (!target) return null;
  // Within 3 points of the goal counts as on target.
  const gap = target.share - target.current;
  let status = 'On target';
  let tone = 'on';
  if (gap > 0.03) {
    status = 'Below target';
    tone = 'below';
  } else if (gap < -0.03) {
    status = 'Above target';
    tone = 'above';
  }
  const minNote = target.min === null ? '' : ` (needs at least ${target.min})`;
  return (
    <Tip
      as="p"
      className={`ratio-line ${tone}`}
      content={
        <>
          <span className="tip-title">Why {target.sharePct}%</span>
          <span className="tip-list">
            {target.reasons.map((r) => (
              <span key={r}>{r}</span>
            ))}
          </span>
        </>
      }
    >
      <span>
        <strong>{status}</strong>: {target.count} of {recruited} recruited ({pct(target.current)}). Aim for {target.sharePct}%,
        about {target.target} of {projected} by the end{minNote}.
      </span>
      <span className="ratio-bar" aria-hidden="true">
        <span className="ratio-now" style={{ width: `${Math.min(100, target.current * 100)}%` }} />
        <span className="ratio-target" style={{ left: `${Math.min(100, target.share * 100)}%` }} />
      </span>
    </Tip>
  );
}

const fmtStat = (s: ShownStat) => {
  if (s.percent) return `${Math.round(s.value * 10) / 10}%`;
  if (s.key === 'hpmax') return String(Math.round(s.value));
  return String(Math.round(s.value * 10) / 10);
};

/** Tooltip body for one stat: name, base → buffed value, and each source on its own line. */
/** Attack Power to 1 decimal (like the rest of the site), Attack Speed to 2. */
const fmtFactor = (key: string, n: number) => {
  const k = key === 'attack_speed' ? 100 : 10;
  return String(Math.round(n * k) / k);
};

/** "Attack Power 14.3 → 17.2 × Attack Speed 1.4": what DPS is made of. */
function DpsFactors({ factors }: Readonly<{ factors: NonNullable<ShownStat['factors']> }>) {
  return (
    <span className="tip-factors">
      {factors.map((f, i) => {
        const changed = Math.abs(f.value - f.base) > 0.001;
        return (
          <span key={f.key} className="tip-factor">
            {i > 0 && (
              <span className="tip-times" aria-label="times">
                ×
              </span>
            )}
            <StatIcon id={f.icon} size={14} />
            <span>{f.label}</span>
            <span className="tip-factor-value">
              {changed ? (
                <>
                  {fmtFactor(f.key, f.base)} → <strong>{fmtFactor(f.key, f.value)}</strong>
                </>
              ) : (
                <strong>{fmtFactor(f.key, f.value)}</strong>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function StatTip({ stat, buffed }: Readonly<{ stat: ShownStat; buffed: boolean }>) {
  return (
    <>
      <span className="tip-title">
        <StatIcon id={stat.icon} size={16} />
        {stat.label}
      </span>
      {stat.factors && <DpsFactors factors={stat.factors} />}
      {buffed ? (
        <>
          <span className="tip-value">
            {fmtStat({ ...stat, value: stat.base })} base → <strong>{fmtStat(stat)}</strong>
          </span>
          <span className="tip-list">
            {stat.sources.map((src) => (
              <span key={src}>{src}</span>
            ))}
          </span>
          {stat.diminishing && (
            <span className="tip-note">
              Diminishing stat: each new source is reduced by what you already have, so totals grow slower than the sum.
            </span>
          )}
        </>
      ) : (
        <span className="tip-value">
          <strong>{fmtStat(stat)}</strong> base, no bonuses from your Relics, Trinkets or Roster
        </span>
      )}
    </>
  );
}

/** Game-panel style stat line: HP, DPS, Run Speed, then any extra stats. Buffed values are highlighted. */
function StatStrip({ stats }: Readonly<{ stats: ShownStat[] }>) {
  return (
    <ul className="stat-strip" aria-label="Stats">
      {stats.map((s) => {
        const buffed = Math.abs(s.value - s.base) > 0.001;
        return (
          <Tip key={s.key} as="li" className={buffed ? 'buffed' : ''} content={<StatTip stat={s} buffed={buffed} />}>
            <StatIcon id={s.icon} size={14} />
            <span className="sr-only">{s.label}</span>
            {fmtStat(s)}
          </Tip>
        );
      })}
    </ul>
  );
}

/** "3 of 5 types": Regular Dude plus up to MAX_TYPES other Dude Types. */
function TypeCounter({ roster }: Readonly<{ roster: Entry[] }>) {
  const used = countedTypes(roster);
  let state = '';
  if (used > MAX_TYPES) state = ' over';
  else if (used === MAX_TYPES) state = ' full';
  return (
    <span className={`type-counter${state}`} title="Regular Dude plus up to 5 other Dude Types">
      {used} of {MAX_TYPES} types
      {used > MAX_TYPES && <span>: remove {used - MAX_TYPES}</span>}
    </span>
  );
}

/** Lines in the left gutter connecting a Dude to the neighbour his effect reaches. */
function Wires({
  links,
  rows,
  gutter: GUTTER,
  laneW,
}: Readonly<{
  links: Link[];
  rows: { top: number; height: number }[];
  gutter: number;
  laneW: number;
}>) {
  if (!rows.length || !links.length) return null;
  const height = rows[rows.length - 1].top + rows[rows.length - 1].height;
  // Assign lanes so overlapping wires sit side by side.
  const lanes: { lo: number; hi: number }[][] = [];
  const placed = links.map((l) => {
    const lo = Math.min(l.from, l.to);
    const hi = Math.max(l.from, l.to);
    let lane = lanes.findIndex((ls) => ls.every((s) => s.hi <= lo || s.lo >= hi));
    if (lane < 0) lane = lanes.push([]) - 1;
    lanes[lane].push({ lo, hi });
    return { l, lane };
  });
  const yOf = (i: number, offset: number) => (rows[i] ? rows[i].top + Math.min(36, rows[i].height / 2) + offset : 0);

  return (
    <svg className="wires" width={GUTTER} height={height} aria-hidden="true">
      <defs>
        {['ability', 'relic'].map((k) => (
          <marker key={k} id={`arrow-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" className={`wire-head ${k}`} />
          </marker>
        ))}
      </defs>
      {placed.map(({ l, lane }, i) => {
        const x = GUTTER - (GUTTER > 40 ? 20 : 12) - lane * laneW;
        const down = l.to > l.from;
        const stagger = 5 + lane * 7;
        const y1 = yOf(l.from, down ? stagger : -stagger);
        const y2 = yOf(l.to, down ? -stagger : stagger);
        return (
          <g key={i} className={`wire ${l.kind}`}>
            <title>{`${l.source}: ${l.label}`}</title>
            <circle cx={GUTTER - 2} cy={y1} r={3.5} />
            <path
              d={`M${GUTTER - 2},${y1} H${x + 4} Q${x},${y1} ${x},${y1 + (down ? 4 : -4)} V${y2 + (down ? -4 : 4)} Q${x},${y2} ${x + 4},${y2} H${GUTTER - 2}`}
              markerEnd={`url(#arrow-${l.kind})`}
            />
          </g>
        );
      })}
    </svg>
  );
}

interface RowProps {
  entry: Entry;
  index: number;
  total: number;
  expanded: boolean;
  links: Link[];
  roster: Entry[];
  notes: { tone: string; text: string }[];
  focus: string[];
  plannedRelics: Set<string>;
  /** Recruit ratio target for this type (null for Regular Dude). */
  target: TypeTarget | null;
  projected: number;
  /** Non-Regular Dudes recruited so far. */
  recruited: number;
  /** Stats with calculated buffs, as the game panel shows them. */
  stats: EntryStats | null;
  onToggle: () => void;
  onCount: (n: number) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  onToggleRelic: (id: string) => void;
  onPickTrinket: () => void;
  onClearTrinket: () => void;
}

function Row(p: Readonly<RowProps>) {
  const { entry, index } = p;
  const dude = dudeById.get(entry.dude)!;
  const trinket = entry.trinket ? trinketById.get(entry.trinket) : null;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.key,
  });
  const outgoing = p.links.filter((l) => l.from === index);
  const incoming = p.links.filter((l) => l.to === index);
  const nameAt = (i: number) => dudeById.get(p.roster[i].dude)!.name;
  const plannedOwn = dude.relics.filter((r) => p.plannedRelics.has(r));

  return (
    <li
      ref={setNodeRef}
      className={`row fam-${dude.family ?? 'none'}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className="row-main">
        <button
          className="handle"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${dude.name}, position ${index + 1}`}
        >
          <span className="pos">{index + 1}</span>
          <span className="grip" aria-hidden="true">⠿</span>
        </button>
        <Sprite id={dude.icon} size={48} />
        <div className="row-id">
          <h3>{dude.name}</h3>
          <div className="row-tags">
            <FamilyTag id={dude.family} count={p.stats?.familyCount ?? undefined} />
            {p.focus.map((col) => {
              const cell = cellOf(dude.id, col);
              return cell ? <ColChip key={col} col={col} cell={cell} grade={gradeOf(dude.id, col)} compact /> : null;
            })}
          </div>
          {p.stats && <StatStrip stats={p.stats.stats} />}
          <RatioLine dude={dude.id} target={p.target} projected={p.projected} recruited={p.recruited} />
        </div>

        <fieldset className="stepper" aria-label={`Number of ${dude.name}s`}>
          <button className="btn icon" onClick={() => p.onCount(Math.max(1, entry.count - 1))} aria-label="One fewer">
            −
          </button>
          <input
            className="input count"
            type="number"
            min={1}
            max={999}
            value={entry.count}
            onChange={(e) => p.onCount(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            aria-label="Count"
          />
          <button className="btn icon" onClick={() => p.onCount(Math.min(999, entry.count + 1))} aria-label="One more">
            +
          </button>
        </fieldset>

        <button
          className={`trinket-slot${trinket ? ' filled' : ''}`}
          onClick={p.onPickTrinket}
          title={trinket ? `Trinket: ${trinket.name}` : 'Choose a Trinket'}
        >
          {trinket ? <Sprite id={trinket.icon} size={32} alt={trinket.name} /> : <span aria-hidden="true">＋</span>}
          <span className="sr-only">{trinket ? `Trinket: ${trinket.name}. Change` : 'Choose a Trinket'}</span>
        </button>

        <div className="row-actions">
          <button className="btn icon ghost" onClick={() => p.onMove(-1)} disabled={index === 0} aria-label="Move up">
            ↑
          </button>
          <button className="btn icon ghost" onClick={() => p.onMove(1)} disabled={index === p.total - 1} aria-label="Move down">
            ↓
          </button>
          <button className="btn icon ghost" onClick={p.onToggle} aria-expanded={p.expanded} aria-label="Details">
            {p.expanded ? '▴' : '▾'}
          </button>
          <button className="btn icon ghost danger" onClick={p.onRemove} aria-label={`Remove ${dude.name}`}>
            ✕
          </button>
        </div>
      </div>

      {(outgoing.length > 0 || incoming.length > 0 || p.notes.length > 0 || plannedOwn.length > 0) && (
        <ul className="row-notes">
          {outgoing.map((l, i) => (
            <li key={`o${i}`} className={`link-note ${l.kind}`}>
              {l.to < index ? '↑' : '↓'} {l.source}: {l.label} <b>{nameAt(l.to)}</b>
            </li>
          ))}
          {incoming.map((l, i) => (
            <li key={`i${i}`} className={`link-note in ${l.kind}`}>
              {l.from < index ? '↑' : '↓'} Gets {l.source} from <b>{nameAt(l.from)}</b>
            </li>
          ))}
          {p.notes.map((n, i) => (
            <li key={`n${i}`} className={`note ${n.tone}`}>
              {n.text}
            </li>
          ))}
          {plannedOwn.map((r) => (
            <li key={r} className="note relic-note">
              <Sprite id={relicById.get(r)!.icon} size={16} /> {relicById.get(r)!.name}
            </li>
          ))}
        </ul>
      )}

      {p.expanded && (
        <div className="row-detail">
          <p className="ability">
            <strong>{dude.ability.name}.</strong> <Desc tokens={dude.ability.desc} />{' '}
            <a href={wikiUrl(dude.id)} target="_blank" rel="noreferrer">
              Open in Dudex
            </a>
          </p>
          <ChartLines dudeId={dude.id} />
          {trinket && (
            <div className="trinket-detail">
              <Sprite id={trinket.icon} size={28} />
              <p>
                <strong>{trinket.name}.</strong> <Desc tokens={trinket.desc} />{' '}
                <button className="link" onClick={p.onClearTrinket}>
                  Remove Trinket
                </button>
              </p>
            </div>
          )}
          {dude.relics.length > 0 && (
            <>
              <h4>{dude.name} Relics</h4>
              <ul className="relic-chips">
                {dude.relics.map((id) => {
                  const r = relicById.get(id)!;
                  const on = p.plannedRelics.has(id);
                  return (
                    <li key={id}>
                      <button className="relic-chip" aria-pressed={on} onClick={() => p.onToggleRelic(id)}>
                        <Sprite id={r.icon} size={28} />
                        <span>
                          <strong>{r.name}</strong>
                          <span className="relic-desc">
                            <Desc tokens={r.desc} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}
