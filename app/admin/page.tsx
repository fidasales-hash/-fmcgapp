'use client';
import { useState, useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

function isExpired(bestBefore: string) {
  if (!bestBefore) return false;
  const d = new Date(bestBefore + 'T00:00:00');
  if (isNaN(d.getTime())) return true; // malformed/AI-generated date → assume expired
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

type EditForm = { name: string; size: string; bestBefore: string; category: string; notes: string; price: string; marketPrice: string; barcode: string };

const CLAUDE_KEY = 'claudeApiEnabled';

function exportCSV(products: Product[]) {
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

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', size: '', bestBefore: '', category: 'Other', notes: '', price: '', marketPrice: '', barcode: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [claudeEnabled, setClaudeEnabled] = useState(true);
  const [editNewPhotos, setEditNewPhotos] = useState<(File | null)[]>([null, null, null]);
  const [editPreviews, setEditPreviews] = useState<string[]>(['', '', '']);
  const [editDragging, setEditDragging] = useState<number | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const bbValue = useRef('');

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
    const d = new Date(p.bestBefore + 'T00:00:00');
    const bb = isNaN(d.getTime()) ? '' : p.bestBefore;
    bbValue.current = bb;
    setEditForm({ name: p.name, size: p.size, bestBefore: bb, category: p.category, notes: p.notes, price: String(p.price ?? 0), marketPrice: String(p.marketPrice ?? 0), barcode: p.barcode ?? '' });
    setEditNewPhotos([null, null, null]);
    setEditPreviews([p.photoUrl || '', p.photoUrl2 || '', p.photoUrl3 || '']);
    setEditDragging(null);
  }

  function handlePhotoDrop(e: React.DragEvent, slot: number) {
    e.preventDefault();
    setEditDragging(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const next = [...editNewPhotos];
    next[slot] = file;
    setEditNewPhotos(next);
    const prevUrl = [...editPreviews];
    prevUrl[slot] = URL.createObjectURL(file);
    setEditPreviews(prevUrl);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setSaveError('');
    try {
      const hasPhotos = editNewPhotos.some(f => f !== null);
      let res: Response;
      if (hasPhotos) {
        const fd = new FormData();
        fd.append('name', editForm.name);
        fd.append('size', editForm.size);
        fd.append('bestBefore', bbValue.current);
        fd.append('category', editForm.category);
        fd.append('notes', editForm.notes);
        fd.append('price', editForm.price);
        fd.append('marketPrice', editForm.marketPrice);
        fd.append('barcode', editForm.barcode.trim());
        if (editNewPhotos[0]) fd.append('photo1', editNewPhotos[0]);
        if (editNewPhotos[1]) fd.append('photo2', editNewPhotos[1]);
        if (editNewPhotos[2]) fd.append('photo3', editNewPhotos[2]);
        res = await fetch(`/api/products/${id}`, { method: 'PATCH', body: fd });
      } else {
        const payload = { ...editForm, bestBefore: bbValue.current, price: parseFloat(editForm.price) || 0, marketPrice: parseFloat(editForm.marketPrice) || 0, barcode: editForm.barcode.trim() };
        res = await fetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (res.ok) {
        const freshRes = await fetch('/api/products');
        if (freshRes.ok) setProducts(await freshRes.json());
        setEditing(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveError(errData.error || `Save failed (${res.status})`);
      }
    } catch {
      setSaveError('Network error — try again');
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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => exportCSV(products)}
            disabled={products.length === 0}
            style={{ fontSize: '0.82rem', fontWeight: 700, padding: '0.4rem 0.8rem', borderRadius: 7, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text)', cursor: 'pointer' }}
          >
            Export CSV
          </button>
          <a href="/">← View Store</a>
        </div>
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
                  <input className="field" type="date" ref={dateRef} defaultValue={editForm.bestBefore} onChange={e => { bbValue.current = e.target.value; }} />
                  <select className="field" value={editForm.category} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, category: v })); }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="field" type="number" min="0" step="0.01" value={editForm.price} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, price: v })); }} placeholder="Price (R)" />
                  <input className="field" type="number" min="0" step="0.01" value={editForm.marketPrice} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, marketPrice: v })); }} placeholder="Market Price (R)" />
                  <textarea className="field" rows={2} value={editForm.notes} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, notes: v })); }} placeholder="Notes" />
                  <input className="field" value={editForm.barcode} onChange={e => { const v = e.target.value; setEditForm(f => ({ ...f, barcode: v })); }} placeholder="Barcode (optional)" inputMode="numeric" />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        onDragOver={e => { e.preventDefault(); setEditDragging(i); }}
                        onDragLeave={() => setEditDragging(null)}
                        onDrop={e => handlePhotoDrop(e, i)}
                        style={{
                          flex: 1, aspectRatio: '1', borderRadius: 8,
                          border: `2px dashed ${editDragging === i ? 'var(--primary, #2563eb)' : 'var(--border, #ddd)'}`,
                          background: editDragging === i ? '#eff6ff' : '#fafafa',
                          overflow: 'hidden', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'default', transition: 'border-color 0.15s, background 0.15s',
                          position: 'relative',
                        }}
                      >
                        {editPreviews[i] ? (
                          <img src={editPreviews[i]} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#aaa', textAlign: 'center', padding: '0.25rem' }}>Drop photo {i + 1}</span>
                        )}
                        {editNewPhotos[i] && (
                          <span style={{ position: 'absolute', bottom: 3, right: 3, background: 'var(--primary,#2563eb)', color: '#fff', fontSize: '0.65rem', borderRadius: 4, padding: '1px 4px' }}>new</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {saveError && <p className="error">{saveError}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => saveEdit(product.id)} disabled={saving}>
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', marginTop: 0 }} onClick={() => { setEditing(null); setSaveError(''); }}>
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
                  {product.barcode && <div className="admin-notes" style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>Barcode: {product.barcode}</div>}
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
