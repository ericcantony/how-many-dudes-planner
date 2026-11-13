import {
  createElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { familyById, sprite, type Token } from '../data/game';
import { CELL_LABELS, columnById, COLUMNS, dudeCells, type Cell } from '../data/chart';

/** Stable keys from each token's own content; a counter only tells repeats of the same text apart. */
function keyTokens(tokens: Token[]) {
  const seen = new Map<string, number>();
  return tokens.map(([kind, text]) => {
    const base = `${kind}:${text}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { kind, text, key: n ? `${base}#${n}` : base };
  });
}

const TOKEN_CLASS: Record<string, string | undefined> = { v: 'tok-var', g: 'tok-term' };

export function Desc({ tokens }: Readonly<{ tokens: Token[] }>) {
  return (
    <>
      {keyTokens(tokens).map((t) => (
        <span key={t.key} className={TOKEN_CLASS[t.kind]}>
          {t.text}
        </span>
      ))}
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

interface TipPos {
  top: number;
  left: number;
  arrow: number;
  above: boolean;
}

const EDGE = 8;

/** Where to draw the tooltip: below the trigger, or above it if there's no room; kept inside the window. */
function placeTip(host: DOMRect, tip: DOMRect): TipPos {
  const left = Math.max(EDGE, Math.min(host.left, window.innerWidth - tip.width - EDGE));
  const below = host.bottom + EDGE;
  const above = below + tip.height > window.innerHeight - EDGE && host.top - tip.height - EDGE > EDGE;
  const anchor = host.left + Math.min(host.width / 2, 20);
  return {
    top: above ? host.top - tip.height - EDGE : below,
    left,
    arrow: Math.max(12, Math.min(anchor - left, tip.width - 20)),
    above,
  };
}

/**
 * Styled hover/focus tooltip that matches the site, instead of the browser's title tooltip.
 * It's drawn on top of the page (a portal), so scrolling panels can't clip it.
 * The trigger is focusable so keyboard users can open it too, unless it sits inside a button.
 */
export function Tip({
  children,
  content,
  className = '',
  as: Tag = 'span',
  focusable = true,
}: Readonly<{ children: ReactNode; content: ReactNode; className?: string; as?: 'span' | 'li' | 'p'; focusable?: boolean }>) {
  const id = useId();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);

  useLayoutEffect(() => {
    if (!open || !host || !tipRef.current) return;
    setPos(placeTip(host.getBoundingClientRect(), tipRef.current.getBoundingClientRect()));
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, host]);

  const show = () => {
    setPos(null);
    setOpen(true);
  };
  const hide = () => setOpen(false);

  const style = pos
    ? ({ top: pos.top, left: pos.left, '--arrow': `${pos.arrow}px` } as CSSProperties)
    : { top: 0, left: 0, visibility: 'hidden' as const };

  return createElement(
    Tag,
    {
      ref: setHost as Ref<HTMLSpanElement>,
      className: `tip-host ${className}`,
      tabIndex: focusable ? 0 : undefined,
      'aria-describedby': open ? id : undefined,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    },
    children,
    open &&
      createPortal(
        <span role="tooltip" id={id} ref={tipRef} className={`tip${pos?.above ? ' above' : ''}`} style={style}>
          {content}
        </span>,
        document.body,
      ),
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

/** Family name and icon; with `count`, also how many Dudes of that Family are on the team (like the game panel). */
export function FamilyTag({ id, count }: Readonly<{ id: string | null; count?: number }>) {
  const f = id ? familyById.get(id) : null;
  if (!f) return <span className="fam-tag fam-none">No Family</span>;
  return (
    <span className={`fam-tag fam-${f.id}`} title={count === undefined ? undefined : `${count} ${f.name} Dudes on your team`}>
      <Sprite id={f.icon} size={16} />
      {f.name}
      {count !== undefined && <span className="fam-count">{count}</span>}
    </span>
  );
}

/** A chart column (stat) chip, coloured by the chart cell when one is given. */
export function ColChip({
  col,
  cell,
  compact = false,
  inButton = false,
}: Readonly<{
  col: string;
  cell?: Cell;
  compact?: boolean;
  /** The chip sits inside a button: show the tooltip on hover but don't make it a separate tab stop. */
  inButton?: boolean;
}>) {
  const c = columnById.get(col)!;
  const label = cell ? `${c.label}: ${CELL_LABELS[cell]}` : c.label;
  const tip = (
    <>
      <span className="tip-title">
        {c.icon && <StatIcon id={c.icon} size={16} />}
        {c.label}
      </span>
      {cell && (
        <span className="tip-cell">
          <span className={`swatch cell-${cell}`} aria-hidden="true" />
          {CELL_LABELS[cell]}
        </span>
      )}
    </>
  );
  const classes = ['col-chip'];
  if (cell) classes.push(`cell-${cell}`);
  if (compact) classes.push('compact');
  return (
    <Tip className={classes.join(' ')} content={tip} focusable={!inButton}>
      {c.icon ? <StatIcon id={c.icon} size={compact ? 14 : 16} /> : null}
      {compact ? <span className={c.icon ? 'sr-only' : 'col-abbr'}>{c.icon ? label : c.short}</span> : c.short}
    </Tip>
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
  // Clicking the backdrop (the dialog element itself, outside its content) closes it. Esc is handled natively.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === d) onClose();
    };
    d.addEventListener('click', onBackdrop);
    return () => d.removeEventListener('click', onBackdrop);
  }, [onClose]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
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
