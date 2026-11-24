'use client';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/lib/types';
import { compressImage } from '@/components/CameraSlot';
import DropZone from '@/components/PhotoDropZone';
import DietChips from '@/components/DietChips';

// Adding a product from the admin Products page: a yellow row at the top of
// the table plus an "Add photos" panel beside it (same layout as Edit photos).
// Uses the same routes as the Add product form (/api/barcode, /api/analyze,
// /api/analyze-date, POST /api/products). Nothing is saved until the row's
// switch is flipped (or Enter is pressed).

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

// A photo slot holds either a web image URL or a file the user added.
interface Slot { src: string; file: File | null }
const EMPTY_SLOT: Slot = { src: '', file: null };

export interface Draft {
  barcode: string;
  name: string;
  size: string;
  category: string;
  price: string;
  marketPrice: string;
  quantity: string;
  bestBefore: string;
  halal: boolean;
  kosher: boolean;
  vegan: boolean;
  webImgs: string[];
  slots: Slot[];                  // [main, photo 2, date label]
  found: '' | 'found' | 'notfound';
  lookingUp: boolean;
  reading: boolean;
  saving: boolean;
  error: string;
  missing: string[];              // fields to mark red
  panelOpen: boolean;
}

function emptyDraft(barcode = ''): Draft {
  return {
    barcode, name: '', size: '', category: 'Other', price: '', marketPrice: '', quantity: '', bestBefore: '', halal: false, kosher: false, vegan: false,
    webImgs: [], slots: [EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT],
    found: '', lookingUp: !!barcode, reading: false, saving: false, error: '', missing: [], panelOpen: true,
  };
}

const aiOn = () => { try { return localStorage.getItem('claudeApiEnabled') !== 'false'; } catch { return true; } };
const revoke = (s: Slot) => { if (s.src.startsWith('blob:')) URL.revokeObjectURL(s.src); };

export function useNewProduct(onAdded: (p: Product) => void, onDuplicate: (id: string, name: string) => void) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;
  const patch = (u: Partial<Draft>) => setDraft(d => d && { ...d, ...u });

  async function startFromBarcode(code: string) {
    code = code.trim();
    if (!code) return;
    draftRef.current?.slots.forEach(revoke);
    setDraft(emptyDraft(code));
    try {
      const res = await fetch('/api/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barcode: code }) });
      const data = res.ok ? await res.json() : {};
      if (data.duplicate) { setDraft(null); onDuplicate(data.duplicate.id, data.duplicate.name); return; }
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

  function startEmpty() { draftRef.current?.slots.forEach(revoke); setDraft(emptyDraft()); }
  function cancel() { draftRef.current?.slots.forEach(revoke); setDraft(null); }

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

  function putSlot(i: number, slot: Slot) {
    const d = draftRef.current;
    if (!d) return;
    revoke(d.slots[i]);
    const slots = [...d.slots]; slots[i] = slot;
    patch({ slots, missing: i === 0 ? d.missing.filter(m => m !== 'photo') : d.missing });
  }

  // Tap a web photo: into the main slot if empty, else the next empty slot.
  // Tap a used one again to take it out.
  function toggleWeb(url: string) {
    const d = draftRef.current;
    if (!d) return;
    const at = d.slots.findIndex(s => s.src === url && !s.file);
    if (at >= 0) { putSlot(at, EMPTY_SLOT); return; }
    const free = d.slots.findIndex(s => !s.src);
    if (free < 0) return;
    putSlot(free, { src: url, file: null });
    if (free === 0 && !d.name) readPhoto(url);
  }

  async function setFile(i: 0 | 1 | 2, file: File) {
    putSlot(i, { src: URL.createObjectURL(file), file });
    const fd = new FormData(); fd.append('photo', file);
    if (i === 2) {
      try {
        const res = await fetch('/api/analyze-date', { method: 'POST', body: fd });
        const data = res.ok ? await res.json() : null;
        if (data?.bestBefore) setDraft(x => x && { ...x, bestBefore: x.bestBefore || data.bestBefore });
      } catch { /* type it */ }
    } else {
      readPhoto(fd);
    }
  }

  const [rotating, setRotating] = useState(false);
  async function rotateMain() {
    const src = draftRef.current?.slots[0].src;
    if (!src) return;
    setRotating(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = src; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight; canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(0, canvas.height); ctx.rotate(-Math.PI / 2); ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error();
      const file = new File([blob], 'rotated.jpg', { type: 'image/jpeg' });
      putSlot(0, { src: URL.createObjectURL(file), file });
    } catch {
      alert("Couldn't rotate this photo. Save it, rotate it, and drop it back in.");
    } finally {
      setRotating(false);
    }
  }

  async function save(): Promise<boolean> {
    const d = draftRef.current;
    if (!d || d.saving) return false;
    const missing: string[] = [];
    if (!d.slots[0].src) missing.push('photo');
    if (!d.name.trim()) missing.push('name');
    if (!d.size.trim()) missing.push('size');
    if (!(parseFloat(d.price) > 0)) missing.push('price');
    if (missing.length) {
      patch({ missing, panelOpen: missing.includes('photo') ? true : d.panelOpen,
        error: missing.includes('photo') ? 'Add a main photo (tap a web photo or drop one in).' : 'Fill in the red boxes.' });
      return false;
    }
    patch({ saving: true, error: '', missing: [] });
    try {
      const fd = new FormData();
      const keys: [string, string][] = [['photo1Url', 'photo'], ['photo2Url', 'photo2'], ['photo3Url', 'photo3']];
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (s.file) fd.append(keys[i][1], await compressImage(s.file));
        else if (s.src) fd.append(keys[i][0], s.src);
      }
      fd.append('name', d.name.trim());
      fd.append('size', d.size.trim());
      fd.append('category', d.category);
      fd.append('price', d.price);
      fd.append('marketPrice', d.marketPrice || '0');
      fd.append('quantity', d.quantity);
      fd.append('bestBefore', d.bestBefore);
      fd.append('barcode', d.barcode);
      fd.append('notes', '');
      fd.append('halal', d.halal ? 'true' : 'false');
      fd.append('kosher', d.kosher ? 'true' : 'false');
      fd.append('vegan', d.vegan ? 'true' : 'false');
      const res = await fetch('/api/products', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { patch({ saving: false, error: data.error ?? `Couldn't add it (${res.status}).` }); return false; }
      cancel();
      onAdded(data.product);
      return true;
    } catch {
      patch({ saving: false, error: 'Network error. Try again.' });
      return false;
    }
  }

  // Ctrl+V while adding: first empty photo slot.
  useEffect(() => {
    if (!draft) return;
    function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const file = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))?.getAsFile();
      const d = draftRef.current;
      if (!file || !d) return;
      e.preventDefault();
      const free = d.slots.findIndex(s => !s.src);
      setFile((free < 0 ? 0 : free) as 0 | 1 | 2, file);
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!draft]);

  return { draft, patch, startFromBarcode, startEmpty, cancel, toggleWeb, setFile, putSlot, rotateMain, rotating, save };
}

type Api = ReturnType<typeof useNewProduct>;

export function NewProductRow({ api, expired }: { api: Api; expired: boolean }) {
  const d = api.draft!;
  const [menu, setMenu] = useState(false);
  const bad = (f: string) => d.missing.includes(f) ? ' inl-bad' : '';
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); api.save(); } if (e.key === 'Escape') api.cancel(); };
  const thumb = d.slots[0].src;
  const namePh = d.lookingUp ? 'Looking up…' : d.found === 'notfound' ? 'Product not found: type the name' : 'Product name';
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.row-menu-wrap')) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);
  return (
    <>
      <tr className="new-row">
        <td className="prod-name-cell">
          <div className="prod-name">
            <button type="button" className="thumb-btn" title="Add photos" aria-label="Add photos" onClick={() => api.patch({ panelOpen: true })}>
              {thumb ? <img src={thumb} alt="" /> : <span className={`dash-noimg${bad('photo')}`} aria-hidden="true" />}
            </button>
            <div className="new-row-name">
              <input autoFocus={!d.barcode} className={`inl-input${bad('name')}`} placeholder={namePh}
                value={d.name} onChange={e => api.patch({ name: e.target.value })} onKeyDown={onKey} />
              {d.barcode && !d.lookingUp && (
                <span className={`new-row-tag ${d.found === 'found' ? 'ok' : 'no'}`}>
                  {d.found === 'found' ? '✓ Found online' : 'Not found online'} · {d.barcode}
                </span>
              )}
            </div>
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
        <td><input type="number" min="0" step="0.01" className="inl-input" placeholder="optional"
          value={d.marketPrice} onChange={e => api.patch({ marketPrice: e.target.value })} onKeyDown={onKey} /></td>
        <td><input type="number" min="0" step="1" className="inl-input" placeholder="—"
          value={d.quantity} onChange={e => api.patch({ quantity: e.target.value })} onKeyDown={onKey} /></td>
        <td><DietChips value={{ halal: d.halal, kosher: d.kosher, vegan: d.vegan }} onToggle={k => api.patch({ [k]: !d[k] })} /></td>
        <td>
          <div className="stock-switch-wrap compact">
            <button type="button" role="switch" aria-checked={false} aria-label="Not added — tap to add to the shop" title="Add to the shop"
              className="stock-switch new" onClick={() => api.save()} disabled={d.saving} />
            <span className="stock-label stock-new">{d.saving ? '…' : 'Add'}</span>
          </div>
        </td>
        <td className="row-menu-wrap">
          <button type="button" className="row-menu-btn" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu(m => !m)}>⋯</button>
          {menu && (
            <div className="row-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); api.patch({ panelOpen: true }); }}>📷 Add photos</button>
              <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); api.cancel(); }}>🗑 Remove</button>
            </div>
          )}
        </td>
      </tr>
      {d.error && (
        <tr className="new-row new-row-msg"><td colSpan={11}>{d.error}</td></tr>
      )}
    </>
  );
}

export function NewProductPanel({ api }: { api: Api }) {
  const d = api.draft!;
  const [main, p2, p3] = d.slots;
  const mainBrowse = useRef<(() => void) | null>(null);
  return (
    <aside className="photo-panel" aria-label="Add photos">
      <div className="photo-panel-head">
        <b title={d.name}>Add photos{d.name ? ` · ${d.name}` : ''}</b>
        <button type="button" onClick={() => api.patch({ panelOpen: false })} aria-label="Close photos">✕</button>
      </div>
      {d.lookingUp && <p className="np-found">Looking up {d.barcode}…</p>}
      {d.reading && <p className="np-found" style={{ color: 'var(--primary)' }}>Reading the photo…</p>}
      {d.webImgs.length > 0 && (
        <>
          <p className="np-sec">Found online (tap to use)</p>
          <div className="np-web">
            {d.webImgs.map(url => {
              const i = d.slots.findIndex(s => s.src === url && !s.file);
              return (
                <button type="button" key={url} className={`np-web-img${i >= 0 ? ' on' : ''}`} onClick={() => api.toggleWeb(url)}>
                  <img src={url} alt="" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                  {i >= 0 && <span>{i + 1}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className={d.missing.includes('photo') ? 'np-main-bad' : undefined}>
        <DropZone main browseRef={mainBrowse} preview={main.src} label="main photo" onFile={f => api.setFile(0, f)} />
      </div>
      <p className="photo-panel-hint center">Drag a photo onto it, click it to browse, or paste (Ctrl+V)</p>
      <div className="photo-panel-btns">
        <button type="button" className="photo-panel-btn" onClick={() => mainBrowse.current?.()}>📁 {main.src ? 'Replace' : 'Browse'}</button>
        <button type="button" className="photo-panel-btn" onClick={api.rotateMain} disabled={!main.src || api.rotating}>
          {api.rotating ? '…' : '↺ Rotate'}
        </button>
      </div>
      <div className="photo-panel-row">
        <DropZone preview={p2.src} label="Photo 2" onFile={f => api.setFile(1, f)} onClear={p2.src ? () => api.putSlot(1, { src: '', file: null }) : undefined} />
        <DropZone preview={p3.src} label="Date label" onFile={f => api.setFile(2, f)} onClear={p3.src ? () => api.putSlot(2, { src: '', file: null }) : undefined} />
      </div>
      <p className="photo-panel-hint">A date label photo fills in Best before.</p>
      <p className="photo-panel-hint">Saved together with the product when you flip its switch.</p>
    </aside>
  );
}
