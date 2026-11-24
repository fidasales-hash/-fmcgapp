'use client';
import { useState, useEffect } from 'react';
import type { Product } from '@/lib/types';
import { compressImage } from '@/components/CameraSlot';
import ProductUploadForm from '@/components/ProductUploadForm';
import StockSwitch from '@/components/StockSwitch';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

const DENIED_MESSAGES: Record<string, string> = {
  pending: 'Your seller application is still under review. Check back once it has been approved.',
  rejected: 'Your seller application was not approved.',
  invalid: 'This seller link is invalid. Please check the URL you were given.',
};

type EditForm = { name: string; size: string; price: string; marketPrice: string; category: string; notes: string };

export default function SellerDashboardClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stockBusy, setStockBusy] = useState<string | null>(null);

  async function toggleStock(id: string, inStock: boolean) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, inStock } : p));
    setStockBusy(id);
    try {
      const res = await fetch(`/api/seller/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-seller-token': token },
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
    <main className="admin-page" style={{ position: 'relative' }}>
      <div className="admin-header">
        <h1>Seller Dashboard</h1>
        <a href="/">View Store</a>
      </div>

      <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>My Products ({products.length})</h2>
      {products.length === 0 && <p className="empty">You haven&apos;t listed any products yet — tap + Add Product to get started.</p>}
      <div className="admin-list" style={{ paddingBottom: '4.5rem' }}>
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
                <StockSwitch
                  inStock={p.inStock !== false}
                  busy={stockBusy === p.id}
                  onToggle={() => toggleStock(p.id, p.inStock === false)}
                />
                <button onClick={() => startEdit(p)} className="btn-edit">Edit</button>
                <button onClick={() => removeProduct(p.id)} disabled={deletingId === p.id} className="btn-delete">
                  {deletingId === p.id ? '…' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating action button — fixed to the viewport, so it's reachable
          regardless of how long the product list below it gets. */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 900,
          background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 999,
          padding: '0.85rem 1.4rem', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}
      >
        + Add Product
      </button>

      {/* Add-product overlay */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg, #fff)', overflowY: 'auto' }}>
          <div className="upload-page" style={{ margin: '0 auto', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Add Product</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => setFormKey(k => k + 1)} style={{ background: 'none', border: '1.5px solid var(--muted)', borderRadius: 8, padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                <button type="button" onClick={() => setAddOpen(false)} style={{ background: 'none', border: '1.5px solid var(--muted)', borderRadius: 8, padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>✕ Close</button>
              </div>
            </div>
            <ProductUploadForm
              key={formKey}
              endpoint="/api/seller/products"
              authHeaders={{ 'x-seller-token': token }}
              onSuccess={(product, continuing) => { setProducts(prev => [product, ...prev]); if (!continuing) { setFormKey(k => k + 1); setAddOpen(false); } }}
              showDatePhoto={false}
            />
          </div>
        </div>
      )}
    </main>
  );
}
