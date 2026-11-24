'use client';
import { useState, useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';
import StockSwitch from '@/components/StockSwitch';
import DietChips from '@/components/DietChips';
import EditableCell from '@/components/EditableCell';
import DropZone from '@/components/PhotoDropZone';
import { isExpired, exportCSV } from '@/lib/productUtils';
import { useNewProduct, NewProductRow, NewProductPanel } from '@/components/NewProductDraft';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

type EditForm = { name: string; size: string; bestBefore: string; category: string; notes: string; price: string; marketPrice: string; barcode: string; kosher: boolean; halal: boolean; vegan: boolean };
type EditPhotos = { file1: File | null; preview1: string; file2: File | null; preview2: string; clear2: boolean; file3: File | null; preview3: string; clear3: boolean };

const CLAUDE_KEY = 'claudeApiEnabled';

type SortKey = 'name' | 'status' | 'bb' | 'category' | 'price' | 'mkt' | 'qty' | 'stock';



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
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
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

  // Side photo panel: reuses the edit state (startEdit fills every field, so
  // saveEdit sends the product unchanged apart from the photos).
  const [photosFor, setPhotosFor] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const photoProduct = photosFor ? products.find(p => p.id === photosFor) ?? null : null;
  const photosChanged = !!(editPhotos.file1 || editPhotos.file2 || editPhotos.file3 || editPhotos.clear2 || editPhotos.clear3);

  // Barcode box: a scan (or Enter / Search) drops a yellow row on top of the
  // table + the Add photos panel beside it. Already in the shop: that row flashes.
  const [flashId, setFlashId] = useState<string | null>(null);
  const [inShopMsg, setInShopMsg] = useState('');
  useEffect(() => {
    if (!inShopMsg) return;
    const t = setTimeout(() => setInShopMsg(''), 4000);
    return () => clearTimeout(t);
  }, [inShopMsg]);
  const scanRef = useRef<HTMLInputElement>(null);
  const np = useNewProduct(
    added => {
      setProducts(prev => [added, ...prev]);
      setFlashId(added.id);
      setTimeout(() => scanRef.current?.focus(), 50);
    },
    (dupId, dupName) => {
      setInShopMsg(dupName);
      // Already in the shop: clear filters and point at the existing row.
      setSearch(''); setCatFilter(''); setStatusFilter('all');
      setFlashId(dupId);
    },
  );
  useEffect(() => { scanRef.current?.focus(); }, []);
  useEffect(() => {
    if (!flashId) return;
    setTimeout(() => document.getElementById(`p-${flashId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    const t = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(t);
  }, [flashId]);

  // Enter in the one box: a barcode (digits only) finds it or starts a new
  // product; an empty box starts an empty new row; words just stay a filter.
  function searchEnter() {
    const text = search.trim();
    if (text && !/^\d{6,14}$/.test(text)) return;
    closePhotos(); setEditing(null); setInShopMsg('');
    setSearch('');
    if (!text) { np.startEmpty(); return; }
    np.startFromBarcode(text);
  }


  function openPhotos(p: Product) {
    np.cancel();
    startEdit(p);
    setEditing(null);
    setSavedOk(false);
    setPhotosFor(p.id);
  }

  function closePhotos() {
    setPhotosFor(null);
    setEditPhotos(EMPTY_PHOTOS);
    setSaveError('');
    setSavedOk(false);
  }

  const mainBrowse = useRef<(() => void) | null>(null);

  async function rotateMain() {
    const src = editPhotos.preview1;
    if (!src) return;
    setRotating(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = src; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error();
      handlePhotoFile(1, new File([blob], 'rotated.jpg', { type: 'image/jpeg' }));
    } catch {
      alert("Couldn't rotate this photo. Download it, rotate it, and drop it back in.");
    } finally {
      setRotating(false);
    }
  }

  // Ctrl+V while the panel is open: fills the first empty extra slot,
  // otherwise replaces the main photo.
  useEffect(() => {
    if (!photosFor) return;
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      setEditPhotos(cur => {
        const slot: 1 | 2 | 3 = !cur.preview2 ? 2 : !cur.preview3 ? 3 : 1;
        setTimeout(() => handlePhotoFile(slot, file), 0);
        return cur;
      });
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosFor]);

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

  // Qty has its own small route (like the stock switch), so it never rides
  // along with the full-product PATCH. Blank clears it.
  async function saveQuantity(p: Product, v: string): Promise<boolean> {
    const n = v === '' ? null : parseInt(v, 10);
    if (n !== null && (isNaN(n) || n < 0)) return false;
    const before = p.quantity ?? null;
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, quantity: n } : x));
    try {
      const res = await fetch(`/api/products/${p.id}/quantity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: n }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, quantity: before } : x));
      return false;
    }
  }

  // Saves one changed field from the table row. The PATCH route overwrites every
  // field, so the whole product goes along with the change applied.
  async function quickSave(p: Product, changes: Partial<Product>): Promise<boolean> {
    const next = { ...p, ...changes };
    setProducts(prev => prev.map(x => x.id === p.id ? next : x));
    try {
      const fd = new FormData();
      fd.append('name', next.name);
      fd.append('size', next.size ?? '');
      fd.append('bestBefore', next.bestBefore ?? '');
      fd.append('category', next.category);
      fd.append('notes', next.notes ?? '');
      fd.append('price', String(Number(next.price) || 0));
      fd.append('marketPrice', String(Number(next.marketPrice) || 0));
      fd.append('barcode', next.barcode ?? '');
      fd.append('kosher', next.kosher ? 'true' : 'false');
      fd.append('halal', next.halal ? 'true' : 'false');
      fd.append('vegan', next.vegan ? 'true' : 'false');
      const res = await fetch(`/api/products/${p.id}`, { method: 'PATCH', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      return true;
    } catch (e) {
      setProducts(prev => prev.map(x => x.id === p.id ? p : x));
      alert(`Couldn't save. ${e instanceof Error && e.message ? e.message : 'Try again.'}`);
      return false;
    }
  }

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.row-menu-wrap')) setMenuOpen(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

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

  // Column sorting. null = default order (newest first, as loaded).
  // Products without a best-before date always go last.
  if (sort) {
    const val = (p: Product): string | number => {
      switch (sort.key) {
        case 'name': return p.name.toLowerCase();
        case 'status': return isExpired(p.bestBefore) ? 1 : 0;
        case 'bb': return p.bestBefore || '';
        case 'category': return p.category.toLowerCase();
        case 'price': return Number(p.price) || 0;
        case 'mkt': return Number(p.marketPrice) || 0;
        case 'qty': return p.quantity ?? -1;
        case 'stock': return p.inStock === false ? 1 : 0;
      }
    };
    filtered.sort((a, b) => {
      if (sort.key === 'bb' && !a.bestBefore !== !b.bestBefore) return a.bestBefore ? -1 : 1;
      const x = val(a), y = val(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? c : -c;
    });
  }

  function sortBy(key: SortKey) {
    setSort(s => s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'price' ? 'desc' : 'asc' });
  }
  function sortTh(k: SortKey, label: string, className?: string) {
    const on = sort?.key === k;
    return (
      <th className={`${className ?? ''}${on ? ' sort-on' : ''}`} aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="sort-btn" onClick={() => sortBy(k)}>
          {label}<span aria-hidden="true">{on ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    );
  }

  function formatBB(bb: string) {
    const d = new Date((bb ?? '') + 'T00:00:00');
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
  }

  return (
    <main className="dash dash-wide">
      {/* One row: title, one box (filter by name, or a barcode + Enter), filters, actions */}
      <div className="prod-bar">
        <h1>Products <span className="dash-count">({filtered.length === products.length ? products.length : `${filtered.length} of ${products.length}`})</span></h1>
        <label className="prod-search">
          <span className="sr-only">Search name, or scan a barcode</span>
          <input ref={scanRef} type="search" placeholder="Search name, or scan a barcode" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchEnter(); } }} />
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
        <button type="button" className="dash-btn" onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}>
          Export CSV
        </button>
        <div className="ai-pill">
          <span>AI auto-fill</span>
          <button type="button" onClick={toggleClaude} aria-pressed={claudeEnabled} className={claudeEnabled ? 'dash-toggle on' : 'dash-toggle'}>
            {claudeEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {inShopMsg && <p className="in-shop-msg">✓ Already in your shop: {inShopMsg}</p>}

      {loading && <p className="loading">Loading…</p>}
      {!loading && products.length === 0 && <p className="empty">No products listed yet.</p>}
      {!loading && products.length > 0 && filtered.length === 0 && <p className="empty">No products match your search.</p>}

      {(filtered.length > 0 || np.draft) && (
        <div className={`prod-split${photoProduct || np.draft?.panelOpen ? ' with-panel' : ''}`}>
        <section className="prod-table-wrap" aria-label="Product list">
          <table className="prod-table">
            <colgroup>
              <col />
              <col style={{ width: 84 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 176 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr>
                {sortTh('name', 'Product')}
                {sortTh('status', 'BB status')}
                {sortTh('bb', 'Best before')}
                <th>Size</th>
                {sortTh('category', 'Category')}
                {sortTh('price', 'Price')}
                {sortTh('mkt', 'Normal price')}
                {sortTh('qty', 'Qty')}
                <th>Dietary</th>
                {sortTh('stock', 'Status')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {np.draft && <NewProductRow api={np} expired={isExpired(np.draft.bestBefore)} />}
              {filtered.map(product => {
                const expired = isExpired(product.bestBefore);
                if (editing === product.id) {
                  return (
                    <tr key={product.id} className="prod-editing">
                      <td colSpan={11}>
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
                  <tr key={product.id} id={`p-${product.id}`} className={flashId === product.id ? 'row-flash' : photosFor === product.id ? 'row-selected' : undefined}>
                    <td className="prod-name-cell">
                      <div className="prod-name">
                        <button type="button" className="thumb-btn" title="Edit photos" aria-label={`Edit photos: ${product.name}`} onClick={() => openPhotos(product)}>
                          {product.photoUrl
                            ? <img src={product.photoUrl} alt="" />
                            : <span className="dash-noimg" aria-hidden="true" />}
                        </button>
                        <EditableCell value={product.name} display={product.name}
                          onSave={v => v ? quickSave(product, { name: v }) : Promise.resolve(false)} />
                      </div>
                    </td>
                    <td>
                      <span className={`badge-small ${expired ? 'badge-expired' : 'badge-fresh'}`}>
                        {expired ? 'Past BB' : 'In Date'}
                      </span>
                    </td>
                    <td className="muted">
                      <EditableCell type="date" value={product.bestBefore ?? ''} display={formatBB(product.bestBefore)}
                        onSave={v => quickSave(product, { bestBefore: v })} />
                    </td>
                    <td className="muted">
                      <EditableCell value={product.size ?? ''} display={product.size || '—'}
                        onSave={v => quickSave(product, { size: v })} />
                    </td>
                    <td>
                      <select className="inl-select" value={product.category} aria-label="Category"
                        onChange={e => quickSave(product, { category: e.target.value })}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <EditableCell type="number" value={String(Number(product.price ?? 0))} display={`R ${Number(product.price ?? 0).toFixed(2)}`}
                        onSave={v => quickSave(product, { price: parseFloat(v) || 0 })} />
                    </td>
                    <td className="mkt-cell">
                      <EditableCell type="number" value={product.marketPrice ? String(Number(product.marketPrice)) : ''}
                        display={product.marketPrice ? `R ${Number(product.marketPrice).toFixed(2)}` : '—'}
                        onSave={v => quickSave(product, { marketPrice: parseFloat(v) || 0 })} />
                    </td>
                    <td className={`qty-cell${product.quantity != null && product.quantity <= 3 ? ' low' : ''}${product.quantity == null ? ' none' : ''}`}>
                      <EditableCell type="number" value={product.quantity != null ? String(product.quantity) : ''}
                        display={product.quantity != null ? String(product.quantity) : '—'}
                        onSave={v => saveQuantity(product, v)} />
                    </td>
                    <td>
                      <DietChips value={{ halal: !!product.halal, kosher: !!product.kosher, vegan: !!product.vegan }}
                        onToggle={d => quickSave(product, { [d]: !product[d] })} />
                    </td>
                    <td>
                      <StockSwitch
                        compact
                        inStock={product.inStock !== false}
                        busy={stockBusy === product.id}
                        onToggle={() => toggleStock(product.id, product.inStock === false)}
                      />
                    </td>
                    <td className="row-menu-wrap">
                      <button type="button" className="row-menu-btn" aria-label="More actions" aria-expanded={menuOpen === product.id}
                        onClick={() => setMenuOpen(m => m === product.id ? null : product.id)}>
                        {deleting === product.id ? '…' : '⋯'}
                      </button>
                      {menuOpen === product.id && (
                        <div className="row-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setMenuOpen(null); openPhotos(product); }}>📷 Edit photos</button>
                          <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(null); removeProduct(product.id); }}>🗑 Remove</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        {np.draft?.panelOpen && <NewProductPanel api={np} />}
        {!np.draft && photoProduct && (
          <aside className="photo-panel" aria-label="Edit photos">
            <div className="photo-panel-head">
              <b title={photoProduct.name}>Photos · {photoProduct.name}</b>
              <button type="button" onClick={closePhotos} aria-label="Close photos">✕</button>
            </div>
            <DropZone main browseRef={mainBrowse} preview={editPhotos.preview1} label="main photo" onFile={f => handlePhotoFile(1, f)} />
            <p className="photo-panel-hint center">Drag a new photo onto it, click it to browse, or paste (Ctrl+V)</p>
            <div className="photo-panel-btns">
              <button type="button" className="photo-panel-btn" onClick={() => mainBrowse.current?.()}>📁 Replace</button>
              <button type="button" className="photo-panel-btn" onClick={rotateMain} disabled={!editPhotos.preview1 || rotating}>
                {rotating ? '…' : '↺ Rotate'}
              </button>
            </div>
            <div className="photo-panel-row">
              <DropZone preview={editPhotos.preview2} label="Photo 2" onFile={f => handlePhotoFile(2, f)}
                onClear={editPhotos.preview2 ? () => clearPhoto(2) : undefined} />
              <DropZone preview={editPhotos.preview3} label="Photo 3" onFile={f => handlePhotoFile(3, f)}
                onClear={editPhotos.preview3 ? () => clearPhoto(3) : undefined} />
            </div>
            {saveError && <p className="error" style={{ margin: '0 0 0.5rem' }}>{saveError}</p>}
            <button type="button" className="btn-primary" style={{ marginBottom: 0 }} disabled={saving || !photosChanged}
              onClick={() => saveEdit(photoProduct.id)}>
              {saving ? 'Saving…' : savedOk && !photosChanged ? 'Saved ✓' : 'Save photos'}
            </button>
          </aside>
        )}
        </div>
      )}
    </main>
  );
}
