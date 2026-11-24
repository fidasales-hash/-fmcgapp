'use client';

export type Diet = 'halal' | 'kosher' | 'vegan';

const CHIPS: [Diet, string, string][] = [
  ['halal', '☪', 'Halal'],
  ['kosher', '✡', 'Kosher'],
  ['vegan', '🌱', 'Vegan'],
];

// Three one-click chips for the dietary badges shown on the shop card.
export default function DietChips({ value, onToggle }: { value: Record<Diet, boolean>; onToggle: (d: Diet) => void }) {
  return (
    <div className="diet-chips">
      {CHIPS.map(([key, icon, label]) => (
        <button key={key} type="button" className={`diet-chip ${key}${value[key] ? ' on' : ''}`}
          aria-pressed={value[key]} title={`${label}: ${value[key] ? 'on' : 'off'}`} aria-label={label}
          onClick={() => onToggle(key)}>
          {icon}
        </button>
      ))}
    </div>
  );
}
