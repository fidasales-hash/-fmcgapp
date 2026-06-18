'use client';
import { useState, useEffect } from 'react';
import type { Product } from '@/lib/types';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks', 'Dairy', 'Bakery', 'Frozen', 'Other'];

function isExpired(bestBefore: string) {
  if (!bestBefore) return false;
  const d = new Date(bestBefore + 'T00:00:00');
  if (isNaN(d.getTime())) return true; // malformed/AI-generated date → assume expired
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

type EditForm = { name: string; size: string; bestBefore: string; category: string; notes: string; price: string };

const CLAUDE_KEY = 'claudeApiEnabled';

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', size: '', bestBefore: '', category: 'Other', notes: '', price: '' });
  const [saving, setSaving] = useState(false);
  const [claudeEnabled, setClaudeEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(CLAUDE_KEY);
    if (stored !== null) setClaudeEnabled(stored !== 'false');
    fetch('/api/products')
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); });
  }, []);

  function toggleClaude() {
    const next = !claudeEnabled;
    setClaudeEnabled(next);
    localStorage.setItem(CLAUDE_KEY, String(next));
  }

  function startEdit(p: Product) {
    setEditing(p.id);
    setEditForm({ name: p.name, size: p.size, bestBefore: p.bestBefore, category: p.category, notes: p.notes, price: String(p.price ?? 0) });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, price: parseFloat(editForm.price) || 0 }),
    });
    if (res.ok) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...editForm, price: parseFloat(editForm.price) || 0 } : p));
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

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem', marginBottom: '1rem',
        background: claudeEnabled ? 'var(--surface, #f4f4f4)' : '#fff3cd',
        borderRadius: 10, border: '1px solid',
        borderColor: claudeEnabled ? 'var(--border, #ddd)' : '#ffc107',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Groq AI Auto-fill</div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 2 }}>
            {claudeEnabled ? 'On — product fields filled automatically from photos' : 'Off — staff enter details manually'}
          </div>
        </div>
        <button
          onClick={toggleClaude}
          style={{
            position: 'relative', width: 52, height: 28, borderRadius: 14,
            border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
            background: claudeEnabled ? 'var(--primary, #2563eb)' : '#ccc',
            transition: 'background 0.2s',
          }}
          aria-label={claudeEnabled ? 'Disable Gemini API auto-fill' : 'Enable Gemini API auto-fill'}
        >
          <span style={{
            position: 'absolute', top: 3, left: claudeEnabled ? 27 : 3,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }} />
        </button>
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
                  <input className="field" type="number" min="0" step="0.01" value={editForm.price} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, price: v })); }} placeholder="Price (R)" />
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
                    BB: {(() => { const d = new Date((product.bestBefore ?? '') + 'T00:00:00'); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB'); })()}
                    {product.size ? ` · ${product.size}` : ''}
                    {' · '}{product.category}
                    {' · '}<strong>R {Number(product.price ?? 0).toFixed(2)}</strong>
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
