'use client';
import { useState, useEffect } from 'react';
import type { Product } from '@/lib/types';

function isExpired(bestBefore: string) {
  return new Date(bestBefore) < new Date(new Date().toDateString());
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); });
  }, []);

  async function removeProduct(id: string) {
    if (!confirm('Remove this product from the store?')) return;
    setDeleting(id);
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  return (
    <main className="admin-page">
      <div className="admin-header">
        <h1>Manage Products</h1>
        <a href="/">← View Store</a>
      </div>

      {loading && <p className="loading">Loading…</p>}

      {!loading && products.length === 0 && (
        <p className="empty">No products listed yet.</p>
      )}

      <div className="admin-list">
        {products.map(product => {
          const expired = isExpired(product.bestBefore);
          return (
            <div key={product.id} className="admin-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.photoUrl} alt={product.name} className="admin-thumb" />
              <div className="admin-info">
                <strong>{product.name}</strong>
                <span className={`badge-small ${expired ? 'badge-expired' : 'badge-fresh'}`}>
                  {expired ? 'Past BB' : 'In Date'}
                </span>
                <div className="admin-meta">
                  BB: {new Date(product.bestBefore + 'T00:00:00').toLocaleDateString('en-GB')}
                  {product.size ? ` · ${product.size}` : ''}
                  {' · '}{product.category}
                </div>
                {product.notes && <div className="admin-notes">{product.notes}</div>}
              </div>
              <button
                onClick={() => removeProduct(product.id)}
                disabled={deleting === product.id}
                className="btn-delete"
              >
                {deleting === product.id ? '…' : 'Remove'}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
