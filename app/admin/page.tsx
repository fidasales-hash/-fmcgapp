'use client';
import { useState, useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

function isExpired(bestBefore: string) {
  if (!bestBefore) return false;
  const d = new Date(bestBefore + 'T00:00:00');
  if (isNaN(d.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

type EditForm = { name: string; size: string; bestBefore: string; category: string; notes: string; price: string; marketPrice: string; barcode: string; kosher: boolean; halal: boolean; vegan: boolean };
type EditPhotos = { file1: File | null; preview1: string; file2: File | null; preview2: string; clear2: boolean; file3: File | null; preview3: string; clear3: boolean };

const CLAUDE_KEY = 'claudeApiEnabled';

function DropZone({ preview, label, onFile, onClear }: { preview: string; label: string; onFile: (f: File) => void; onClear?: () => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const enterCount = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    enterCount.current++;
    setDragging(true);
  }

  function handleDragLeave() {
    enterCount.current--;
    if (enterCount.current === 0) setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    enterCount.current = 0;
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) onFile(f);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
          border: preview
            ? `0.5px solid var(--border, #ddd)`
            : `1.5px dashed ${dragging ? 'var(--primary, #2563eb)' : 'var(--border, #ddd)'}`,
          background: dragging ? 'rgba(37,99,235,0.05)' : preview ? 'transparent' : 'var(--surface, #f9f9f9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, position: 'relative', transition: 'border-color 0.15s',
        }}
      >
        {preview ? (
          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        ) : (
          <>
            <span style={{ fontSize: '1.25rem', color: '#ccc', pointerEvents: 'none' }}>+</span>
            <span style={{ fontSize: '0.68rem', color: '#bbb', pointerEvents: 'none' }}>{dragging ? 'Drop' : label}</span>
          </>
        )}
        {dragging && preview && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary, #2563eb)', fontWeight: 600 }}>Drop</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {preview && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--primary, #2563eb)', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>Replace</span>
          {onClear && (
            <span style={{ fontSize: '0.7rem', color: '#bbb', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onClear(); }}>· Remove</span>
          )}
        </div>
      )}
      {!preview && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#bbb' }}>{label}</span>
        </div>
      )}
    </div>
  );
}

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

const EMPTY_PHOTOS: EditPhotos = { file1: null, preview1: '', file2: null, preview2: '', clear2: false, file3: null, preview3: '', clear3: false };

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', size: '', bestBefore: '', category: 'Other', notes: '', price: '', marketPrice: '', barcode: '', kosher: false, halal: false, vegan: false });
  const [editPhotos, setEditPhotos] = useState<EditPhotos>(EMPTY_PHOTOS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedOk, setSavedOk] = useState(false);
  const [claudeEnabled, setClaudeEnabled] = useState(true);
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
    setEditForm({ name: p.name, size: p.size, bestBefore: bb, category: p.category, notes: p.notes, price: String(p.price ?? 0), marketPrice: String(p.marketPrice ?? 0), barcode: p.barcode ?? '', kosher: p.kosher ?? false, halal: p.halal ?? false, vegan: p.vegan ?? false });
    setEditPhotos({ file1: null, preview1: p.photoUrl, file2: null, preview2: p.photoUrl2 ?? '', clear2: false, file3: null, preview3: p.photoUrl3 ?? '', clear3: false });
    setSaveError('');
  }

  function handlePhotoFile(slot: 1 | 2 | 3, file: File) {
    const url = URL.createObjectURL(file);
    setEditPhotos(p => {
      if (slot === 1) {
        if (p.preview1.startsWith('blob:')) URL.revokeObjectURL(p.preview1);
        return { ...p, file1: file, preview1: url };
      }
      if (slot === 2) {
        if (p.preview2.startsWith('blob:')) URL.revokeObjectURL(p.preview2);
        return { ...p, file2: file, preview2: url, clear2: false };
      }
      if (p.preview3.startsWith('blob:')) URL.revokeObjectURL(p.preview3);
      return { ...p, file3: file, preview3: url, clear3: false };
    });
  }

  function clearPhoto(slot: 2 | 3) {
    setEditPhotos(p => {
      if (slot === 2) {
        if (p.preview2.startsWith('blob:')) URL.revokeObjectURL(p.preview2);
        return { ...p, file2: null, preview2: '', clear2: true };
      }
      if (p.preview3.startsWith('blob:')) URL.revokeObjectURL(p.preview3);
      return { ...p, file3: null, preview3: '', clear3: true };
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setSaveError('');
    try {
      const fd = new FormData();
      fd.append('name', editForm.name);
      fd.append('size', editForm.size);
      fd.append('bestBefore', bbValue.current);
      fd.append('category', editForm.category);
      fd.append('notes', editForm.notes);
      fd.append('price', String(parseFloat(editForm.price) || 0));
      fd.append('marketPrice', String(parseFloat(editForm.marketPrice) || 0));
      fd.append('barcode', editForm.barcode.trim());
      fd.append('kosher', editForm.kosher ? 'true' : 'false');
      fd.append('halal', editForm.halal ? 'true' : 'false');
      fd.append('vegan', editForm.vegan ? 'true' : 'false');
      if (editPhotos.file1) fd.append('photo1', editPhotos.file1);
      if (editPhotos.file2) fd.append('photo2', editPhotos.file2);
      if (editPhotos.file3) fd.append('photo3', editPhotos.file3);
      if (editPhotos.clear2) fd.append('clear2', 'true');
      if (editPhotos.clear3) fd.append('clear3', 'true');

      const res = await fetch(`/api/products/${id}`, { method: 'PATCH', body: fd });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        const newUrl1: string = resData.photoUrl ?? '';
        const newUrl2: string = resData.photoUrl2 ?? '';
        const newUrl3: string = resData.photoUrl3 ?? '';
        setEditPhotos(ep => ({
          ...ep,
          file1: null, preview1: newUrl1 || ep.preview1,
          file2: null, preview2: newUrl2,
          file3: null, preview3: newUrl3,
          clear2: false, clear3: false,
        }));
        setProducts(prev => prev.map(p =>
          p.id === id
            ? { ...p, photoUrl: newUrl1 || p.photoUrl, photoUrl2: newUrl2, photoUrl3: newUrl3 }
            : p
        ));
        setSavedOk(true);
        setTimeout(() => setSavedOk(false), 2500);
      } else {
        setSaveError(resData.error || `Save failed (${res.status})`);
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
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {([['halal', '☪ Halal', '#16a34a'], ['kosher', '✡ Kosher', '#2563eb'], ['vegan', '🌱 Vegan', '#15803d']] as const).map(([key, label, color]) => {
                      const on = editForm[key];
                      return (
                        <button key={key} type="button" onClick={() => setEditForm(f => ({ ...f, [key]: !f[key] }))}
                          style={{ padding: '0.3rem 0.7rem', borderRadius: 20, border: `1.5px solid ${color}`, background: on ? color : 'transparent', color: on ? '#fff' : color, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border, #eee)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.5rem' }}>Photos</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <DropZone
                        preview={editPhotos.preview1}
                        label="Main"
                        onFile={f => handlePhotoFile(1, f)}
                      />
                      <DropZone
                        preview={editPhotos.preview2}
                        label="Photo 2"
                        onFile={f => handlePhotoFile(2, f)}
                        onClear={editPhotos.preview2 ? () => clearPhoto(2) : undefined}
                      />
                      <DropZone
                        preview={editPhotos.preview3}
                        label="Photo 3"
                        onFile={f => handlePhotoFile(3, f)}
                        onClear={editPhotos.preview3 ? () => clearPhoto(3) : undefined}
                      />
                    </div>
                  </div>

                  {saveError && <p className="error">{saveError}</p>}
                  {savedOk && <p style={{ color: '#16a34a', fontSize: '0.82rem', margin: '0.25rem 0' }}>Saved ✓</p>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" style={{ flex: 1, padding: '0.5rem' }} onClick={() => saveEdit(product.id)} disabled={saving}>
                      {saving ? '…' : 'Save'}
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '0.5rem', marginTop: 0 }} onClick={() => { setEditing(null); setSaveError(''); setSavedOk(false); setEditPhotos(EMPTY_PHOTOS); }}>
                      {savedOk ? 'Done' : 'Cancel'}
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
