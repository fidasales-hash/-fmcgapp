'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { Product, Seller } from '@/lib/types';
import { isExpired, isExpiringSoon, exportCSV } from '@/lib/productUtils';

const CLAUDE_KEY = 'claudeApiEnabled';

function formatRand(n: number) {
  return `R${Number(n).toFixed(2).replace(/\.00$/, '')}`;
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiOn, setAiOn] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(CLAUDE_KEY);
    if (stored !== null) setAiOn(stored !== 'false');

    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/sellers').then(r => r.json()),
    ])
      .then(([p, s]) => {
        setProducts(Array.isArray(p) ? p : []);
        setSellers(Array.isArray(s) ? s : []);
      })
      .catch(() => setError('Could not load data. Refresh to try again.'))
      .finally(() => setLoading(false));
  }, []);

  function toggleAi() {
    const next = !aiOn;
    setAiOn(next);
    localStorage.setItem(CLAUDE_KEY, String(next));
  }

  const expired = products.filter(p => isExpired(p.bestBefore));
  const live = products.length - expired.length;
  const soon = products.filter(p => isExpiringSoon(p.bestBefore));
  const missing = products.filter(p => !p.photoUrl || !p.barcode);
  const pending = sellers.filter(s => s.status === 'pending');
  const approved = sellers.filter(s => s.status === 'approved');

  const recent = [...products]
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, 6);
  const topOrdered = [...products]
    .filter(p => (p.orderCount ?? 0) > 0)
    .sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))
    .slice(0, 5);
  const byCategory = Object.entries(
    products.reduce<Record<string, number>>((acc, p) => {
      const c = p.category || 'Other';
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const show = (n: number) => (loading ? '…' : n);

  return (
    <main className="dash">
      <div className="dash-head">
        <div>
          <h1>Dashboard</h1>
          <p>Everything in the shop at a glance</p>
        </div>
        <div className="dash-actions">
          <button type="button" className="dash-btn" onClick={() => exportCSV(products)} disabled={products.length === 0}>
            Export CSV
          </button>
          <Link href="/admin/products" className="dash-btn dash-btn-primary">+ Add product</Link>
        </div>
      </div>

      {error && <p className="dash-error">{error}</p>}

      <section className="dash-stats" aria-label="Key numbers">
        <div className="dash-stat">
          <div className="dash-stat-label">Products live</div>
          <div className="dash-stat-value">{show(live)}</div>
          <div className="dash-stat-sub">In date, showing in store</div>
        </div>
        <div className="dash-stat dash-stat-warn">
          <div className="dash-stat-label">Expiring in 14 days</div>
          <div className="dash-stat-value">{show(soon.length)}</div>
          <div className="dash-stat-sub">Mark down or promote</div>
        </div>
        <div className="dash-stat dash-stat-bad">
          <div className="dash-stat-label">Past best before</div>
          <div className="dash-stat-value">{show(expired.length)}</div>
          <div className="dash-stat-sub">Check, mark down or remove</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat-label">Sellers</div>
          <div className="dash-stat-value">{show(approved.length)}</div>
          <div className="dash-stat-sub"><strong>{loading ? '…' : pending.length} pending</strong> approval</div>
        </div>
      </section>

      {!loading && (pending.length > 0 || expired.length > 0 || missing.length > 0) && (
        <section className="dash-attention" aria-label="Needs attention">
          <h2>Needs attention</h2>
          <div>
            {pending.length > 0 && (
              <Link href="/admin/sellers">{pending.length} seller application{pending.length === 1 ? '' : 's'} to review →</Link>
            )}
            {expired.length > 0 && (
              <Link href="/admin/products">{expired.length} product{expired.length === 1 ? '' : 's'} past best before →</Link>
            )}
            {missing.length > 0 && (
              <Link href="/admin/products">{missing.length} product{missing.length === 1 ? '' : 's'} missing a photo or barcode →</Link>
            )}
          </div>
        </section>
      )}

      <div className="dash-cols">
        <section className="dash-card dash-main" aria-label="Recently added">
          <div className="dash-card-head">
            <h2>Recently added</h2>
            <Link href="/admin/products">All products →</Link>
          </div>
          {loading ? (
            <p className="dash-muted">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="dash-muted">No products yet.</p>
          ) : (
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr><th>Product</th><th>Category</th><th>Price</th><th>Best before</th></tr>
                </thead>
                <tbody>
                  {recent.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="dash-prod">
                          {p.photoUrl
                            ? <img src={p.photoUrl} alt="" />
                            : <span className="dash-noimg" aria-hidden="true" />}
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="dash-muted">{p.category}</td>
                      <td><strong>{formatRand(p.price)}</strong></td>
                      <td className={isExpired(p.bestBefore) ? 'dash-bad' : 'dash-muted'}>{p.bestBefore || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="dash-side">
          <section className="dash-card" aria-label="Most ordered">
            <h2>Most ordered</h2>
            {loading ? (
              <p className="dash-muted">Loading…</p>
            ) : topOrdered.length === 0 ? (
              <p className="dash-muted">No orders yet.</p>
            ) : (
              <ol className="dash-top">
                {topOrdered.map(p => (
                  <li key={p.id}>{p.name} <span className="dash-muted">· {p.orderCount} order{p.orderCount === 1 ? '' : 's'}</span></li>
                ))}
              </ol>
            )}
          </section>

          <section className="dash-card" aria-label="Products by category">
            <h2>By category</h2>
            {loading ? (
              <p className="dash-muted">Loading…</p>
            ) : (
              <ul className="dash-cats">
                {byCategory.map(([cat, n]) => (
                  <li key={cat}><span>{cat}</span><span className="dash-muted">{n}</span></li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card dash-ai" aria-label="AI auto-fill">
            <div>
              <div className="dash-ai-title">AI auto-fill</div>
              <div className="dash-muted">Fill product details from photos</div>
            </div>
            <button type="button" onClick={toggleAi} aria-pressed={aiOn} className={aiOn ? 'dash-toggle on' : 'dash-toggle'}>
              {aiOn ? 'On' : 'Off'}
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}
