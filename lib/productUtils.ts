import type { Product } from './types';

export function isExpired(bestBefore: string) {
  if (!bestBefore) return false;
  const d = new Date(bestBefore + 'T00:00:00');
  if (isNaN(d.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

/** True when the best-before date is today or within the next `days` days. */
export function isExpiringSoon(bestBefore: string, days = 14) {
  if (!bestBefore) return false;
  const d = new Date(bestBefore + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return d >= today && d <= limit;
}

export function exportCSV(products: Product[]) {
  const headers = ['Name', 'Size', 'Category', 'Best Before', 'Status', 'Price (R)', 'Added'];
  const rows = products.map(p => {
    const d = new Date((p.bestBefore ?? '') + 'T00:00:00');
    const bb = isNaN(d.getTime()) ? '' : p.bestBefore;
    const status = isExpired(p.bestBefore) ? 'Past Best Before' : 'In Date';
    const added = new Date(p.addedAt).toLocaleDateString('en-GB');
    return [p.name, p.size, p.category, bb, status, Number(p.price).toFixed(2), added];
  });
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clearanceshop-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
