'use client';
import { useState, useEffect, useRef } from 'react';
import type { Product } from '@/lib/types';
import { CameraSlot, compressImage } from '@/components/CameraSlot';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

const DENIED_MESSAGES: Record<string, string> = {
  pending: 'Your seller application is still under review. Check back once it has been approved.',
  rejected: 'Your seller application was not approved.',
  invalid: 'This seller link is invalid. Please check the URL you were given.',
};

const SIZE_RE = /^(\d+(\.\d+)?\s*(ml|g|l|kg)(\s*x\s*\d+(\.\d+)?\s*(ml|g|l|kg))?|\d+'?s)$/i;

type NewProductForm = { name: string; size: string; price: string; marketPrice: string; category: string; notes: string; bestBefore: string; barcode: string };
const EMPTY_NEW: NewProductForm = { name: '', size: '', price: '', marketPrice: '', category: 'Other', notes: '', bestBefore: '', barcode: '' };

type EditForm = { name: string; size: string; price: string; marketPrice: string; category: string; notes: string };

export default function SellerDashboardClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [newForm, setNewForm] = useState<NewProductForm>(EMPTY_NEW);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [newPhoto2, setNewPhoto2] = useState<File | null>(null);
  const [sizeOverride, setSizeOverride] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanSupported, setScanSupported] = useState(false);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setScanSupported('BarcodeDetector' in window);
    return () => stopScan();
  }, []);

  async function startScan() {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
        await scanVideoRef.current.play();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
      });
      let detecting = false;
      scanIntervalRef.current = setInterval(async () => {
        if (detecting || !scanVideoRef.current) return;
        detecting = true;
        try {
          const barcodes = await detector.detect(scanVideoRef.current);
          if (barcodes.length > 0) {
            const code: string = barcodes[0].rawValue;
            stopScan();
            setNewForm(f => ({ ...f, barcode: code }));
          }
        } catch { /* frame not ready */ }
        detecting = false;
      }, 200);
    } catch {
      setScanning(false);
    }
  }

  function stopScan() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    scanStreamRef.current?.getTracks().forEach(t => t.stop());
    scanStreamRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    fetch('/api/seller/products', { headers: { 'x-seller-token': token } })
      .then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setDenied(data.status ?? 'invalid');
          return;
        }
        setProducts(await res.json());
      })
      .catch(() => setDenied('invalid'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    if (!newForm.name.trim()) return setAddError('Product name required');
    if (!newPhoto) return setAddError('Photo required');
    if (!newForm.size.trim()) return setAddError("Size / weight is required (e.g. 330ml, 500g, 2L, 1kg, 10's)");
    if (!sizeOverride && !SIZE_RE.test(newForm.size.trim())) return setAddError("Size must be a number with unit — e.g. 330ml, 500g, 2L, 1.5kg, 6 x 330ml, 10's");

    setAdding(true);
    try {
      const fd = new FormData();
      fd.append('name', newForm.name.trim());
      fd.append('size', newForm.size.trim());
      fd.append('price', newForm.price || '0');
      fd.append('marketPrice', newForm.marketPrice || '0');
      fd.append('category', newForm.category);
      fd.append('notes', newForm.notes.trim());
      fd.append('bestBefore', newForm.bestBefore);
      fd.append('barcode', newForm.barcode.trim());
      fd.append('photo', await compressImage(newPhoto));
      if (newPhoto2) fd.append('photo2', await compressImage(newPhoto2));

      const res = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'x-seller-token': token },
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(prev => [data.product, ...prev]);
        setNewForm(EMPTY_NEW);
        setNewPhoto(null);
        setNewPhoto2(null);
        setSizeOverride(false);
      } else {
        setAddError(data.error ?? 'Failed to add product');
      }
    } catch {
      setAddError('Network error — please try again');
    }
    setAdding(false);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditForm({ name: p.name, size: p.size, price: String(p.price), marketPrice: String(p.marketPrice), category: p.category, notes: p.notes });
    setEditPhoto(null);
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', editForm.name.trim());
      fd.append('size', editForm.size.trim());
      fd.append('price', editForm.price || '0');
      fd.append('marketPrice', editForm.marketPrice || '0');
      fd.append('category', editForm.category);
      fd.append('notes', editForm.notes.trim());
      if (editPhoto) fd.append('photo', await compressImage(editPhoto));

      const res = await fetch(`/api/seller/products/${id}`, {
        method: 'PATCH',
        headers: { 'x-seller-token': token },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(prev => prev.map(p => (p.id === id
          ? { ...p, ...editForm, price: Number(editForm.price) || 0, marketPrice: Number(editForm.marketPrice) || 0, photoUrl: data.photoUrl || p.photoUrl }
          : p)));
        setEditingId(null);
        setEditForm(null);
        setEditPhoto(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/seller/products/${id}`, {
        method: 'DELETE',
        headers: { 'x-seller-token': token },
      });
      if (res.ok) setProducts(prev => prev.filter(p => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <main className="upload-page"><p className="loading">Loading…</p></main>;

  if (denied) {
    return (
      <main className="success-screen">
        <h2>Not Available</h2>
        <p style={{ color: 'var(--muted)' }}>{DENIED_MESSAGES[denied] ?? DENIED_MESSAGES.invalid}</p>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-header">
        <h1>Seller Dashboard</h1>
        <a href="/">View Store</a>
      </div>

      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Add Product</h2>
      {addError && <p className="error">{addError}</p>}
      <form onSubmit={handleAdd} style={{ marginBottom: '2rem' }}>
        {scanning && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#000' }}>
            <video ref={scanVideoRef} autoPlay playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', width: '78%', height: 90, border: '3px solid #fff', borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
            <p style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, calc(-60% + 106px))', color: '#fff', fontSize: '0.9rem', textAlign: 'center', width: '80%', margin: 0 }}>
              Aim barcode at the box
            </p>
            <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={stopScan} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>✕ Cancel</button>
            </div>
          </div>
        )}
        <div className="field-wrap">
          <label className="field-label">Barcode</label>
          {scanSupported && (
            <button type="button" onClick={startScan} className="btn-primary" style={{ width: '100%', marginBottom: '0.5rem' }}>
              📷 Scan Barcode
            </button>
          )}
          <input
            className="field" style={{ marginBottom: 0 }}
            inputMode="numeric" placeholder="or type barcode number"
            value={newForm.barcode}
            onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, barcode: v })); }}
          />
        </div>
        <CameraSlot label="Product Photo *" tapLabel="Take Photo" analyzing={false} onFile={setNewPhoto} />
        <CameraSlot label="Second Photo (optional)" tapLabel="Take Photo" compact analyzing={false} onFile={setNewPhoto2} />
        <div className="field-wrap">
          <input className="field" value={newForm.name} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, name: v })); }} placeholder="Product name *" />
        </div>
        <input
          className="field" style={{ marginBottom: '0.25rem' }}
          value={newForm.size} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, size: v })); }}
          placeholder={sizeOverride ? "Size / weight * (any format)" : "Size / weight * (e.g. 330ml, 500g, 2L, 1kg, 10's)"}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={sizeOverride} onChange={e => setSizeOverride(e.target.checked)} style={{ cursor: 'pointer' }} />
          Custom format (e.g. Assorted, Various)
        </label>
        <div className="field-wrap">
          <label className="field-label">Category</label>
          <select className="field" value={newForm.category} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, category: v })); }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="field" type="number" min="0" step="0.01" value={newForm.price} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, price: v })); }} placeholder="Price (R) *" />
          <input className="field" type="number" min="0" step="0.01" value={newForm.marketPrice} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, marketPrice: v })); }} placeholder="Market Price (R)" />
        </div>
        <div className="field-wrap">
          <label className="field-label">Best Before</label>
          <input className="field" type="date" value={newForm.bestBefore} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, bestBefore: v })); }} />
        </div>
        <div className="field-wrap">
          <textarea className="field" rows={2} value={newForm.notes} onChange={e => { const v = e.target.value; setNewForm(f => ({ ...f, notes: v })); }} placeholder="Notes (optional)" />
        </div>
        <button type="submit" className="btn-primary" disabled={adding}>{adding ? 'Adding…' : 'Add to Store'}</button>
      </form>

      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>My Products ({products.length})</h2>
      {products.length === 0 && <p className="empty">You haven&apos;t listed any products yet.</p>}
      <div className="admin-list">
        {products.map(p => (
          <div key={p.id} className="admin-row" style={{ flexWrap: 'wrap' }}>
            <img src={p.photoUrl} alt={p.name} className="admin-thumb" />
            {editingId === p.id && editForm ? (
              <div className="edit-form">
                <input className="field" value={editForm.name} onChange={e => { const v = e.target.value; setEditForm(f => f && { ...f, name: v }); }} placeholder="Name" />
                <input className="field" value={editForm.size} onChange={e => { const v = e.target.value; setEditForm(f => f && { ...f, size: v }); }} placeholder="Size / weight" />
                <select className="field" value={editForm.category} onChange={e => { const v = e.target.value; setEditForm(f => f && { ...f, category: v }); }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="field" type="number" min="0" step="0.01" value={editForm.price} onChange={e => { const v = e.target.value; setEditForm(f => f && { ...f, price: v }); }} placeholder="Price (R)" />
                <input className="field" type="number" min="0" step="0.01" value={editForm.marketPrice} onChange={e => { const v = e.target.value; setEditForm(f => f && { ...f, marketPrice: v }); }} placeholder="Market Price (R)" />
                <textarea className="field" rows={2} value={editForm.notes} onChange={e => { const v = e.target.value; setEditForm(f => f && { ...f, notes: v }); }} placeholder="Notes" />
                <input type="file" accept="image/*" onChange={e => setEditPhoto(e.target.files?.[0] ?? null)} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button type="button" className="btn-primary" style={{ flex: 1, marginBottom: 0 }} disabled={saving} onClick={() => saveEdit(p.id)}>
                    {saving ? '…' : 'Save'}
                  </button>
                  <button type="button" className="btn-secondary" style={{ flex: 1, marginBottom: 0 }} onClick={() => { setEditingId(null); setEditForm(null); setEditPhoto(null); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-info">
                <strong>{p.name}</strong>
                <div className="admin-meta">
                  {p.size ? `${p.size} · ` : ''}{p.category}{' · '}<strong>R {Number(p.price ?? 0).toFixed(2)}</strong>
                </div>
                {p.notes && <div className="admin-notes">{p.notes}</div>}
              </div>
            )}
            {editingId !== p.id && (
              <div className="admin-actions">
                <button onClick={() => startEdit(p)} className="btn-edit">Edit</button>
                <button onClick={() => removeProduct(p.id)} disabled={deletingId === p.id} className="btn-delete">
                  {deletingId === p.id ? '…' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
