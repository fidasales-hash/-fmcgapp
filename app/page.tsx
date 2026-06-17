'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/lib/types';

function isExpired(bestBefore: string) {
  return new Date(bestBefore) < new Date(new Date().toDateString());
}

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products');
    setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    window.addEventListener('focus', fetchProducts);
    return () => window.removeEventListener('focus', fetchProducts);
  }, [fetchProducts]);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category))).sort()];

  const filtered = products.filter(p => {
    const expired = isExpired(p.bestBefore);
    return (
      (category === 'All' || p.category === category) &&
      (status === 'All' || (status === 'In Date' && !expired) || (status === 'Past Best Before' && expired))
    );
  });

  return (
    <>
      <header className="site-header">
        <h1>Warehouse Clearance</h1>
        <p>In-date &amp; past best-before stock at discounted prices</p>
        <nav className="header-nav">
          <a href="/upload">Staff Upload</a>
          <a href="/admin">Admin</a>
        </nav>
      </header>

      <div className="filters">
        <div className="filter-row">
          {categories.map(c => (
            <button key={c} className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {(['All', 'In Date', 'Past Best Before'] as const).map(s => (
            <button
              key={s}
              className={`chip${status === s ? ' active' + (s === 'In Date' ? ' green' : s === 'Past Best Before' ? ' red' : '') : ''}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="loading">Loading products…</p>}

      {!loading && filtered.length === 0 && (
        <p className="empty">No products found. {products.length === 0 ? 'Staff can add products via the upload page.' : 'Try changing the filters.'}</p>
      )}

      <div className="grid">
        {filtered.map(product => {
          const expired = isExpired(product.bestBefore);
          return (
            <div key={product.id} className={`card ${expired ? 'expired' : 'fresh'}`}>
              <div className="photo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.photoUrl} alt={product.name} loading="lazy" />
                <span className={`badge ${expired ? 'badge-expired' : 'badge-fresh'}`}>
                  {expired ? 'Past Best Before' : 'In Date'}
                </span>
              </div>
              <div className="card-body">
                <h2>{product.name}</h2>
                {product.size && <p className="size">{product.size}</p>}
                <p className="best-before">
                  BB: {new Date(product.bestBefore + 'T00:00:00').toLocaleDateString('en-GB')}
                </p>
                <span className="cat-chip">{product.category}</span>
                {product.notes && <p className="notes">{product.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
