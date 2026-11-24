'use client';

// One-tap in-stock / sold-out switch, shared by the admin and seller product lists.
export default function StockSwitch({
  inStock,
  busy,
  onToggle,
}: {
  inStock: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="stock-switch-wrap">
      <span className={`stock-label ${inStock ? 'stock-in' : 'stock-out'}`}>
        {inStock ? 'In stock' : 'Sold out'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={inStock}
        aria-label={inStock ? 'In stock — tap to mark sold out' : 'Sold out — tap to mark in stock'}
        className={`stock-switch ${inStock ? '' : 'off'}`}
        onClick={onToggle}
        disabled={busy}
      />
    </div>
  );
}
