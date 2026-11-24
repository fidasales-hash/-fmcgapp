'use client';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/types';
import { compressImage } from '@/components/CameraSlot';

// "Scan to add" on the admin Products page: a yellow row at the top of the
// table plus a photo panel beside it. Uses the same routes as the Add product
// form (/api/barcode, /api/analyze, /api/analyze-date, POST /api/products).

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

export interface Draft {
  barcode: string;
  name: string;
  size: string;
  category: string;
  price: string;
  marketPrice: string;
  bestBefore: string;
  webImgs: string[];
  picked: string[];               // web images, in slot order (max 3)
  files: (File | null)[];         // own photos: [front, back, date label]
  previews: string[];
  found: '' | 'found' | 'notfound';
  lookingUp: boolean;
  reading: boolean;
  saving: boolean;
  error: string;
  missing: string[];              // fields to mark red
}

function emptyDraft(barcode = ''): Draft {
  return {
    barcode, name: '', size: '', category: 'Other', price: '', marketPrice: '', bestBefore: '',
    webImgs: [], picked: [], files: [null, null, null], previews: ['', '', ''],
    found: '', lookingUp: !!barcode, reading: false, saving: false, error: '', missing: [],
  };
}

const aiOn = () => { try { return localStorage.getItem('claudeApiEnabled') !== 'false'; } catch { return true; } };

export function useNewProduct(onAdded: (p: Product) => void, onDuplicate: (id: string) => void) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const patch = (u: Partial<Draft>) => setDraft(d => d && { ...d, ...u });

  async function startFromBarcode(code: string) {
    code = code.trim();
    if (!code) return;
    setDraft(emptyDraft(code));
    try {
      const res = await fetch('/api/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barcode: code }) });
      const data = res.ok ? await res.json() : {};
      if (data.duplicate) { setDraft(null); onDuplicate(data.duplicate.id); return; }
      const s = data.sources ?? {};
      const imgs: string[] = Array.from(new Set([...(s.off?.images ?? []), ...(s.upc?.images ?? []), ...(s.serper?.images ?? [])]));
      setDraft(d => d && d.barcode === code ? {
        ...d, lookingUp: false, found: data.found ? 'found' : 'notfound',
        name: d.name || data.name || '', size: d.size || data.size || '',
        category: CATEGORIES.includes(data.category) ? data.category : d.category,
        marketPrice: d.marketPrice || (data.marketPrice ? String(data.marketPrice) : ''),
        webImgs: imgs,
      } : d);
    } catch {
      patch({ lookingUp: false, found: 'notfound' });
    }
  }

  function startEmpty() { setDraft(emptyDraft()); }
  function cancel() {
    draftRef.current?.previews.forEach(u => u.startsWith('blob:') && URL.revokeObjectURL(u));
    setDraft(null);
  }

  // Fill name/size/category from a photo when they're still empty.
  async function readPhoto(body: FormData | string) {
    if (!aiOn()) return;
    patch({ reading: true });
    try {
      const res = typeof body === 'string'
        ? await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoUrl: body }) })
        : await fetch('/api/analyze', { method: 'POST', body });
      const data = res.ok ? await res.json() : null;
      if (data && !data.error) {
        setDraft(d => d && {
          ...d,
          name: d.name || data.name || '',
          size: d.size || data.size || '',
          category: d.category === 'Other' && CATEGORIES.includes(data.category) ? data.category : d.category,
          marketPrice: d.marketPrice || (data.marketPrice ? String(data.marketPrice) : ''),
        });
      }
    } catch { /* fill in by hand */ }
    patch({ reading: false });
  }

  function togglePick(url: string) {
    const d = draftRef.current;
    if (!d) return;
    const has = d.picked.includes(url);
    const picked = has ? d.picked.filter(u => u !== url) : d.picked.length < 3 ? [...d.picked, url] : d.picked;
    patch({ picked, missing: d.missing.filter(m => m !== 'photo') });
    if (!has && picked[0] === url && !d.name) readPhoto(url);
  }

  async function setFile(slot: 0 | 1 | 2, file: File) {
    const d = draftRef.current;
    if (!d) return;
    if (d.previews[slot].startsWith('blob:')) URL.revokeObjectURL(d.previews[slot]);
    const files = [...d.files]; files[slot] = file;
    const previews = [...d.previews]; previews[slot] = URL.createObjectURL(file);
    patch({ files, previews, missing: d.missing.filter(m => m !== 'photo') });
    if (slot === 2) {
      try {
        const fd = new FormData(); fd.append('photo', file);
        const res = await fetch('/api/analyze-date', { method: 'POST', body: fd });
        const data = res.ok ? await res.json() : null;
        if (data?.bestBefore) setDraft(x => x && { ...x, bestBefore: x.bestBefore || data.bestBefore });
      } catch { /* type it */ }
    } else {
      const fd = new FormData(); fd.append('photo', file);
      readPhoto(fd);
    }
  }

  function clearFile(slot: 0 | 1 | 2) {
    const d = draftRef.current;
    if (!d) return;
    if (d.previews[slot].startsWith('blob:')) URL.revokeObjectURL(d.previews[slot]);
    const files = [...d.files]; files[slot] = null;
    const previews = [...d.previews]; previews[slot] = '';
    patch({ files, previews });
  }

  async function save() {
    const d = draftRef.current;
    if (!d || d.saving) return;
    const missing: string[] = [];
    if (!d.picked[0] && !d.files[0]) missing.push('photo');
    if (!d.name.trim()) missing.push('name');
    if (!d.size.trim()) missing.push('size');
    if (!(parseFloat(d.price) > 0)) missing.push('price');
    if (missing.length) {
      patch({ missing, error: missing.includes('photo') ? 'Pick a web photo or add a front photo.' : 'Fill in the red boxes.' });
      return;
    }
    patch({ saving: true, error: '', missing: [] });
    try {
      const fd = new FormData();
      const slotKeys: [string, string][] = [['photo1Url', 'photo'], ['photo2Url', 'photo2'], ['photo3Url', 'photo3']];
      for (let i = 0; i < 3; i++) {
        if (d.picked[i]) fd.append(slotKeys[i][0], d.picked[i]);
        else if (d.files[i]) fd.append(slotKeys[i][1], await compressImage(d.files[i]!));
      }
      fd.append('name', d.name.trim());
      fd.append('size', d.size.trim());
      fd.append('category', d.category);
      fd.append('price', d.price);
      fd.append('marketPrice', d.marketPrice || '0');
      fd.append('bestBefore', d.bestBefore);
      fd.append('barcode', d.barcode);
      fd.append('notes', '');
      const res = await fetch('/api/products', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { patch({ saving: false, error: data.error ?? `Couldn't add it (${res.status}).` }); return; }
      cancel();
      onAdded(data.product);
    } catch {
      patch({ saving: false, error: 'Network error. Try again.' });
    }
  }

  // Ctrl+V while adding: first empty own-photo slot (front, then back).
  useEffect(() => {
    if (!draft) return;
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const file = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))?.getAsFile();
      const d = draftRef.current;
      if (!file || !d) return;
      e.preventDefault();
      setFile(!d.files[0] ? 0 : !d.files[1] ? 1 : 2, file);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!draft]);

  return { draft, patch, startFromBarcode, startEmpty, cancel, togglePick, setFile, clearFile, save };
}

type Api = ReturnType<typeof useNewProduct>;

export function NewProductRow({ api, expired }: { api: Api; expired: boolean }) {
  const d = api.draft!;
  const bad = (f: string) => d.missing.includes(f) ? ' inl-bad' : '';
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); api.save(); } if (e.key === 'Escape') api.cancel(); };
  const thumb = d.picked[0] || d.previews[0];
  return (
    <>
      <tr className="new-row">
        <td className="prod-name-cell">
          <div className="prod-name">
            {thumb ? <img src={thumb} alt="" /> : <span className={`dash-noimg${bad('photo')}`} aria-hidden="true" />}
            <input autoFocus={!d.barcode} className={`inl-input${bad('name')}`} placeholder={d.lookingUp ? 'Looking up…' : 'Product name'}
              value={d.name} onChange={e => api.patch({ name: e.target.value })} onKeyDown={onKey} />
          </div>
        </td>
        <td><span className={`badge-small ${expired ? 'badge-expired' : 'badge-fresh'}`}>{expired ? 'Past BB' : 'In Date'}</span></td>
        <td><input type="date" className="inl-input" value={d.bestBefore} onChange={e => api.patch({ bestBefore: e.target.value })} onKeyDown={onKey} /></td>
        <td><input className={`inl-input${bad('size')}`} placeholder="500g" value={d.size} onChange={e => api.patch({ size: e.target.value })} onKeyDown={onKey} /></td>
        <td>
          <select className="inl-select" value={d.category} onChange={e => api.patch({ category: e.target.value })} aria-label="Category">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </td>
        <td><input autoFocus={!!d.barcode} type="number" min="0" step="0.01" className={`inl-input${bad('price')}`} placeholder="0.00"
          value={d.price} onChange={e => api.patch({ price: e.target.value, missing: d.missing.filter(m => m !== 'price') })} onKeyDown={onKey} /></td>
        <td className="muted" style={{ fontSize: '0.8rem' }}>New</td>
        <td><button type="button" className="new-row-add" onClick={api.save} disabled={d.saving}>{d.saving ? '…' : 'Add'}</button></td>
      </tr>
      {d.error && (
        <tr className="new-row new-row-msg"><td colSpan={8}>{d.error} <button type="button" onClick={api.cancel}>Cancel</button></td></tr>
      )}
    </>
  );
}

function PhotoTile({ label, preview, onFile, onClear }: { label: string; preview: string; onFile: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="np-tile-wrap">
      <div className={`np-tile${preview ? ' has' : ''}${over ? ' over' : ''}`} role="button" tabIndex={0}
        onClick={() => ref.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter') ref.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) onFile(f); }}>
        {preview ? <img src={preview} alt="" /> : <span>{over ? 'Drop' : `+ ${label}`}</span>}
      </div>
      {preview ? <button type="button" className="np-x" onClick={onClear}>✕ remove</button> : <span className="np-lbl">{label}</span>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </div>
  );
}

export function NewProductPanel({ api }: { api: Api }) {
  const d = api.draft!;
  return (
    <aside className="photo-panel" aria-label="New product photos">
      <div className="photo-panel-head">
        <b>New product · photos</b>
        <button type="button" onClick={api.cancel} aria-label="Cancel new product">✕</button>
      </div>
      {d.barcode && (
        <p className="np-found">
          {d.lookingUp ? `Looking up ${d.barcode}…` : d.found === 'found' ? `✓ Found online · ${d.barcode}` : `Not found online · ${d.barcode}. Add a front photo and the details are read from it.`}
        </p>
      )}
      {d.reading && <p className="np-found" style={{ color: 'var(--primary)' }}>Reading the photo…</p>}
      {d.webImgs.length > 0 && (
        <>
          <p className="np-sec">Web photos (tap up to 3)</p>
          <div className="np-web">
            {d.webImgs.map(url => {
              const i = d.picked.indexOf(url);
              return (
                <button type="button" key={url} className={`np-web-img${i >= 0 ? ' on' : ''}`} onClick={() => api.togglePick(url)}>
                  <img src={url} alt="" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                  {i >= 0 && <span>{i + 1}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className={`np-sec${d.missing.includes('photo') ? ' np-bad' : ''}`}>{d.webImgs.length ? 'Or your own' : 'Your photos'}</p>
      <div className="np-own">
        {(['Front', 'Back', 'Date label'] as const).map((label, i) => (
          <PhotoTile key={label} label={label} preview={d.previews[i]} onFile={f => api.setFile(i as 0 | 1 | 2, f)} onClear={() => api.clearFile(i as 0 | 1 | 2)} />
        ))}
      </div>
      <p className="photo-panel-hint">Click a tile to browse, drag a photo in, or paste with Ctrl+V.</p>
      <div className="np-more">
        <label>Normal price (R)
          <input type="number" min="0" step="0.01" value={d.marketPrice} placeholder="optional" onChange={e => api.patch({ marketPrice: e.target.value })} />
        </label>
      </div>
    </aside>
  );
}
