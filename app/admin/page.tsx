'use client';
import { useState, useEffect } from 'react';
import type { Product } from '@/lib/types';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks', 'Dairy', 'Bakery', 'Frozen', 'Other'];

function isExpired(bestBefore: string) {
  return new Date(bestBefore) < new Date(new Date().toDateString());
}

type EditForm = { name: string; size: string; bestBefore: string; category: string; notes: string };

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', size: '', bestBefore: '', category: 'Other', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); });
  }, []);

  function startEdit(p: Product) {
    setEditing(p.id);
    setEditForm({ name: p.name, size: p.size, bestBefore: p.bestBefore, category: p.category, notes: p.notes });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...editForm } : p));
      setEditing(null);
    }
    setSaving(false);
  }

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
      {!loading && products.length === 0 && <p className="empty">No products listed yet.</p>}

      <div className="admin-list">
        {products.map(product => {
          const expired = isExpired(product.bestBefore);
          const isEditing = editing === product.id;

          return (
            <div key={product.id} className="admin-row" style={{ flexWrap: 'wrap' }}>
              <img src={product.photoUrl} alt={product.name} className="admin-thumb" />

              {isEditing ? (
                <div className="edit-form">
                  <input className="field" value={editForm.name} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, name: v })); }} placeholder="Name" />
                  <input className="field" value={editForm.size} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, size: v })); }} placeholder="Size / weight" />
                  <input className="field" type="date" value={editForm.bestBefore} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, bestBefore: v })); }} />
                  <select className="field" value={editForm.category} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, category: v })); }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <textarea className="field" rows={2} value={editForm.notes} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, notes: v })); }} placeholder="Notes" />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => saveEdit(product.id)} disabled={saving}>
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', marginTop: 0 }} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
              )}

              {!isEditing && (
                <div className="admin-actions">
                  <button onClick={() => startEdit(product)} className="btn-edit">Edit</button>
                  <button onClick={() => removeProduct(product.id)} disabled={deleting === product.id} className="btn-delete">
                    {deleting === product.id ? '…' : 'Remove'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
