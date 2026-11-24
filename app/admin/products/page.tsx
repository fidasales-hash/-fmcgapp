'use client';
import { useState, useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';
import StockSwitch from '@/components/StockSwitch';
import { isExpired, exportCSV } from '@/lib/productUtils';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

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

const EMPTY_PHOTOS: EditPhotos = { file1: null, preview1: '', file2: null, preview2: '', clear2: false, file3: null, preview3: '', clear3: false };

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [stockBusy, setStockBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', size: '', bestBefore: '', category: 'Other', notes: '', price: '', marketPrice: '', barcode: '', kosher: false, halal: false, vegan: false });
  const [editPhotos, setEditPhotos] = useState<EditPhotos>(EMPTY_PHOTOS);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedOk, setSavedOk] = useState(false);
  const [claudeEnabled, setClaudeEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in' | 'past'>('all');
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

  async function toggleStock(id: string, inStock: boolean) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock } : p));
    setStockBusy(id);
    try {
      const res = await fetch(`/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock: !inStock } : p));
      alert("Couldn't update stock. Try again.");
    } finally {
      setStockBusy(null);
    }
  }

  async function removeProduct(id: string) {
    if (!confirm('Remove this product from the store?')) return;
    setDeleting(id);
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleting(null);
  }

  const q = search.trim().toLowerCase();
  const filtered = products.filter(p => {
    if (q && !p.name.toLowerCase().includes(q) && !(p.barcode ?? '').includes(q)) return false;
    if (catFilter && p.category !== catFilter) return false;
    if (statusFilter === 'in' && isExpired(p.bestBefore)) return false;
    if (statusFilter === 'past' && !isExpired(p.bestBefore)) return false;
    return true;
  });

  function formatBB(bb: string) {
    const d = new Date((bb ?? '') + 'T00:00:00');
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
  }

  return (
    <main className="dash">
      <div className="dash-head">
        <h1>Products <span className="dash-count">({filtered.length === products.length ? products.length : `${filtered.length} of ${products.length}`})</span></h1>
        <div className="dash-actions">
          <div className="ai-pill">
            <span>AI auto-fill</span>
            <button type="button" onClick={toggleClaude} aria-pressed={claudeEnabled} className={claudeEnabled ? 'dash-toggle on' : 'dash-toggle'}>
              {claudeEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <button type="button" className="dash-btn" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
            Export CSV
          </button>
          <a href="/upload" className="dash-btn dash-btn-primary">+ Add product</a>
        </div>
      </div>

      <div className="prod-filters">
        <label className="prod-search">
          <span className="sr-only">Search products</span>
          <input type="search" placeholder="Search name or barcode" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | 'in' | 'past')}>
            <option value="all">All statuses</option>
            <option value="in">In date</option>
            <option value="past">Past BB</option>
          </select>
        </label>
      </div>

      {loading && <p className="loading">Loading…</p>}
      {!loading && products.length === 0 && <p className="empty">No products listed yet.</p>}
      {!loading && products.length > 0 && filtered.length === 0 && <p className="empty">No products match your search.</p>}

      {filtered.length > 0 && (
        <section className="prod-table-wrap" aria-label="Product list">
          <table className="prod-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Best before</th>
                <th>Size</th>
                <th>Category</th>
                <th className="num">Price</th>
                <th>Stock</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const expired = isExpired(product.bestBefore);
                if (editing === product.id) {
                  return (
                    <tr key={product.id} className="prod-editing">
                      <td colSpan={8}>
                        <div className="prod-edit">
                          <img src={product.photoUrl} alt={product.name} className="admin-thumb" />
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
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={product.id}>
                    <td className="prod-name-cell">
                      <div className="prod-name">
                        {product.photoUrl
                          ? <img src={product.photoUrl} alt="" />
                          : <span className="dash-noimg" aria-hidden="true" />}
                        <span title={product.name}>{product.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-small ${expired ? 'badge-expired' : 'badge-fresh'}`}>
                        {expired ? 'Past BB' : 'In Date'}
                      </span>
                    </td>
                    <td className="muted">{formatBB(product.bestBefore)}</td>
                    <td className="muted">{product.size || '—'}</td>
                    <td className="muted">{product.category}</td>
                    <td className="num"><strong>R {Number(product.price ?? 0).toFixed(2)}</strong></td>
                    <td>
                      <StockSwitch
                        inStock={product.inStock !== false}
                        busy={stockBusy === product.id}
                        onToggle={() => toggleStock(product.id, product.inStock === false)}
                      />
                    </td>
                    <td className="num prod-actions">
                      <button onClick={() => startEdit(product)} className="btn-edit">Edit</button>
                      <button onClick={() => removeProduct(product.id)} disabled={deleting === product.id} className="btn-delete">
                        {deleting === product.id ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
