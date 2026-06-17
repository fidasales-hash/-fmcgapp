'use client';
import { useState, useCallback } from 'react';
import type { Product } from '@/lib/types';

function isExpired(bestBefore: string) {
  return new Date(bestBefore) < new Date(new Date().toDateString());
}

export default function AdminPage() {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [pinError, setPinError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const checkPin = useCallback(async () => {
    setPinError('');
    const res = await fetch('/api/pin-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      sessionStorage.setItem('wh-pin', pin);
      setAuthed(true);
      setLoading(true);
      const r2 = await fetch('/api/products');
      setProducts(await r2.json());
      setLoading(false);
    } else {
      setPinError('Incorrect PIN — try again');
    }
  }, [pin]);

  async function removeProduct(id: string) {
    if (!confirm('Remove this product from the store?')) return;
    setDeleting(id);
    const storedPin = sessionStorage.getItem('wh-pin') ?? pin;
    await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${storedPin}` },
    });
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  if (!authed) {
    return (
      <main className="pin-gate">
        <h1>Admin Panel</h1>
        <p>Enter your PIN to manage products</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkPin()}
          placeholder="••••"
          className="pin-input"
          autoFocus
        />
        {pinError && <p className="error">{pinError}</p>}
        <button onClick={checkPin} className="btn-primary">Enter</button>
      </main>
    );
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
