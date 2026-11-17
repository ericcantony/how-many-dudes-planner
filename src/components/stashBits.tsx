import type { Reason } from '../lib/flyer';
import { FOOD_SECOND, NO_SECOND, secondLabel } from '../data/food';

function reasonClass(delta: number) {
  if (delta > 0) return 'pro';
  if (delta < 0) return 'con';
  return 'note';
}

function reasonSign(delta: number) {
  if (delta > 0) return '+';
  if (delta < 0) return '−';
  return '•';
}

/** "+ Team damage +4%", "− Replaces his Bongos", "• Read the text". */
export function ReasonList({ reasons }: Readonly<{ reasons: Reason[] }>) {
  return (
    <ul className="reasons">
      {reasons.map((x) => (
        <li key={x.text} className={reasonClass(x.delta)}>
          <span className="sign" aria-hidden="true">
            {reasonSign(x.delta)}
          </span>
          {x.text}
        </li>
      ))}
    </ul>
  );
}

/** A meal's random second stat, with its amount; empty = not known yet. */
export function SecondStatSelect({
  foodId,
  value,
  emptyLabel,
  onChange,
  className,
}: Readonly<{ foodId: string; value: string | null; emptyLabel: string; onChange: (col: string | null) => void; className?: string }>) {
  return (
    <select className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Second stat">
      <option value="">{emptyLabel}</option>
      {[...FOOD_SECOND.map((s) => s.col), NO_SECOND].map((col) => (
        <option key={col} value={col}>
          {secondLabel(foodId, col)}
        </option>
      ))}
    </select>
  );
}
