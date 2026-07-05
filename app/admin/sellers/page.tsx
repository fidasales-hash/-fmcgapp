'use client';
import { useState, useEffect } from 'react';
import type { Seller } from '@/lib/types';

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sellers')
      .then(res => res.json())
      .then(data => setSellers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function setStatus(id: string, status: 'approved' | 'rejected') {
    setBusy(id);
    try {
      const res = await fetch(`/api/sellers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setSellers(prev => prev.map(s => (s.id === id ? { ...s, status } : s)));
    } finally {
      setBusy(null);
    }
  }

  function copyLink(seller: Seller) {
    const link = `${window.location.origin}/seller/${seller.token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(seller.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const pending = sellers.filter(s => s.status === 'pending');
  const approved = sellers.filter(s => s.status === 'approved');
  const rejected = sellers.filter(s => s.status === 'rejected');

  return (
    <main className="admin-page">
      <div className="admin-header">
        <h1>Sellers</h1>
        <a href="/admin">← Manage Products</a>
      </div>

      {loading && <p className="loading">Loading…</p>}
      {!loading && sellers.length === 0 && <p className="empty">No seller applications yet.</p>}

      {pending.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', margin: '1rem 0 0.5rem' }}>Pending ({pending.length})</h2>
          <div className="admin-list">
            {pending.map(seller => (
              <div key={seller.id} className="admin-row">
                <div className="admin-info">
                  <strong>{seller.businessName}</strong>
                  <div className="admin-meta">
                    {seller.contactName && `${seller.contactName} · `}{seller.phone}{seller.email ? ` · ${seller.email}` : ''}
                  </div>
                </div>
                <div className="admin-actions">
                  <button className="btn-edit" disabled={busy === seller.id} onClick={() => setStatus(seller.id, 'approved')}>Approve</button>
                  <button className="btn-delete" disabled={busy === seller.id} onClick={() => setStatus(seller.id, 'rejected')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {approved.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', margin: '1.5rem 0 0.5rem' }}>Approved ({approved.length})</h2>
          <div className="admin-list">
            {approved.map(seller => (
              <div key={seller.id} className="admin-row">
                <div className="admin-info">
                  <strong>{seller.businessName}</strong>
                  <div className="admin-meta">
                    {seller.contactName && `${seller.contactName} · `}{seller.phone}{seller.email ? ` · ${seller.email}` : ''}
                  </div>
                </div>
                <div className="admin-actions">
                  <button className="btn-edit" onClick={() => copyLink(seller)}>
                    {copiedId === seller.id ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {rejected.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', margin: '1.5rem 0 0.5rem', color: 'var(--muted)' }}>Rejected ({rejected.length})</h2>
          <div className="admin-list">
            {rejected.map(seller => (
              <div key={seller.id} className="admin-row" style={{ opacity: 0.6 }}>
                <div className="admin-info">
                  <strong>{seller.businessName}</strong>
                  <div className="admin-meta">{seller.phone}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
