import { useEffect, useRef, type ReactNode } from 'react';
import { familyById, sprite, type Token } from '../data/game';
import { CELL_LABELS, columnById, COLUMNS, dudeCells, type Cell } from '../data/chart';

export function Desc({ tokens }: Readonly<{ tokens: Token[] }>) {
  return (
    <>
      {tokens.map(([kind, text], i) =>
        kind === 't' ? (
          <span key={i}>{text}</span>
        ) : (
          <span key={i} className={kind === 'v' ? 'tok-var' : 'tok-term'}>
            {text}
          </span>
        ),
      )}
    </>
  );
}

export function Sprite({ id, size = 40, alt = '' }: Readonly<{ id: string; size?: number; alt?: string }>) {
  return (
    <img
      className="sprite"
      src={sprite(id)}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
      draggable={false}
    />
  );
}

/** Stat icons are white glyphs; draw them as a mask so they take the current text colour in both themes. */
export function StatIcon({ id, size = 16 }: Readonly<{ id: string; size?: number }>) {
  const url = `url("${sprite(id)}")`;
  return (
    <span
      className="stat-icon"
      aria-hidden="true"
      style={{ width: size, height: size, maskImage: url, WebkitMaskImage: url }}
    />
  );
}

export function FamilyTag({ id }: Readonly<{ id: string | null }>) {
  const f = id ? familyById.get(id) : null;
  if (!f) return <span className="fam-tag fam-none">No Family</span>;
  return (
    <span className={`fam-tag fam-${f.id}`}>
      <Sprite id={f.icon} size={16} />
      {f.name}
    </span>
  );
}

/** A chart column (stat) chip, coloured by the chart cell when one is given. */
export function ColChip({
  col,
  cell,
  compact = false,
  title,
}: Readonly<{
  col: string;
  cell?: Cell;
  compact?: boolean;
  title?: string;
}>) {
  const c = columnById.get(col)!;
  const label = cell ? `${c.label}: ${CELL_LABELS[cell]}` : c.label;
  return (
    <span className={`col-chip${cell ? ` cell-${cell}` : ''}${compact ? ' compact' : ''}`} title={title ?? label}>
      {c.icon ? <StatIcon id={c.icon} size={compact ? 14 : 16} /> : null}
      {compact ? <span className={c.icon ? 'sr-only' : 'col-abbr'}>{c.icon ? label : c.short}</span> : c.short}
    </span>
  );
}

const CELL_GROUPS: { cells: Cell[]; label: string }[] = [
  { cells: ['Y', 'G'], label: 'Gives' },
  { cells: ['B', 'D'], label: 'Scales' },
  { cells: ['R'], label: 'Enemies' },
];

/** One Dude's synergy-chart row, grouped: what he gives the team, what he scales with, enemy debuffs. */
export function ChartLines({ dudeId }: Readonly<{ dudeId: string }>) {
  const cells = dudeCells(dudeId);
  if (!cells) return <p className="focus-line muted small">Not in the synergy chart.</p>;
  return (
    <div className="focus">
      {CELL_GROUPS.map((g) => {
        const cols = COLUMNS.filter((c) => g.cells.includes(cells.get(c.id)!));
        if (!cols.length) return null;
        return (
          <p key={g.label} className="focus-line">
            <span className="focus-label">{g.label}</span>
            {cols.map((c) => (
              <ColChip key={c.id} col={c.id} cell={cells.get(c.id)} />
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Legend for chart cell colours. */
export function CellLegend() {
  return (
    <ul className="legend">
      {(['Y', 'G', 'B', 'D', 'R'] as Cell[]).map((c) => (
        <li key={c}>
          <span className={`swatch cell-${c}`} aria-hidden="true" />
          {CELL_LABELS[c]}
        </li>
      ))}
    </ul>
  );
}

/** Native <dialog> wrapper: Esc and backdrop click close it. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}>) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="modal-body">
          <header className="modal-head">
            <h2>{title}</h2>
            <button className="btn ghost" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
