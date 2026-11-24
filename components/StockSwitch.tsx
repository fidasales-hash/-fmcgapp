'use client';

// One-tap in-stock / sold-out switch, shared by the admin and seller product lists.
// compact: switch first, then a short "On" / "Off" label (admin Products table).
export default function StockSwitch({
  inStock,
  busy,
  onToggle,
  compact,
}: {
  inStock: boolean;
  busy?: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const label = compact ? (inStock ? 'On' : 'Off') : (inStock ? 'In stock' : 'Sold out');
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={inStock}
      aria-label={inStock ? 'In stock — tap to mark sold out' : 'Sold out — tap to mark in stock'}
      title={inStock ? 'In stock' : 'Sold out'}
      className={`stock-switch ${inStock ? '' : 'off'}`}
      onClick={onToggle}
      disabled={busy}
    />
  );
  return (
    <div className={`stock-switch-wrap${compact ? ' compact' : ''}`}>
      {compact && button}
      <span className={`stock-label ${inStock ? 'stock-in' : 'stock-out'}`}>{label}</span>
      {!compact && button}
    </div>
  );
}
