'use client';
import { useState } from 'react';
import ProductUploadForm from '@/components/ProductUploadForm';
import type { Product } from '@/lib/types';

export default function UploadPage() {
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);

  if (success) {
    return (
      <main className="success-screen">
        <div className="success-icon">✓</div>
        <h2>Product Added!</h2>
        <button onClick={() => { setSuccess(false); setFormKey(k => k + 1); }} className="btn-primary">Add Another</button>
        <a href="/" className="btn-secondary">View Store</a>
      </main>
    );
  }

  return (
    <main className="upload-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Add Product</h1>
        <button type="button" onClick={() => setFormKey(k => k + 1)} style={{ background: 'none', border: '1.5px solid var(--muted)', borderRadius: 8, padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
      </div>
      <ProductUploadForm
        key={formKey}
        endpoint="/api/products"
        onSuccess={(_product: Product, continuing?: boolean) => { if (!continuing) setSuccess(true); }}
      />
      <a href="/" className="btn-secondary" style={{ marginTop: '0.75rem' }}>← Back to Store</a>
    </main>
  );
}
