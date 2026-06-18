'use client';
import { useState, useRef } from 'react';

async function compressImage(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(new File([blob!], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.82);
    };
    img.src = url;
  });
}

async function rotateCW(file: File): Promise<{ file: File; preview: string }> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        const rotated = new File([blob!], 'photo.jpg', { type: 'image/jpeg' });
        resolve({ file: rotated, preview: URL.createObjectURL(rotated) });
      }, 'image/jpeg', 0.92);
    };
    img.src = url;
  });
}

export default function UploadPage() {
  const [preview1, setPreview1] = useState<string | null>(null);
  const [preview2, setPreview2] = useState<string | null>(null);
  const [rotated1, setRotated1] = useState<File | null>(null);
  const [rotated2, setRotated2] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', size: '', bestBefore: '', notes: '' });
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  function handlePhoto(n: 1 | 2) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (n === 1) { setPreview1(URL.createObjectURL(file)); setRotated1(null); }
      else         { setPreview2(URL.createObjectURL(file)); setRotated2(null); }

      setAnalyzing(true);
      try {
        const fd = new FormData();
        fd.append('photo', file);
        const res = await fetch('/api/analyze', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          setForm(prev => ({
            name:        data.name        || prev.name,
            size:        data.size        || prev.size,
            bestBefore:  data.bestBefore  || prev.bestBefore,
            notes:       prev.notes,
          }));
        }
      } catch {
        // silently fail — staff can fill in manually
      }
      setAnalyzing(false);
    };
  }

  async function handleRotate(n: 1 | 2) {
    const current = n === 1
      ? (rotated1 ?? fileRef1.current?.files?.[0])
      : (rotated2 ?? fileRef2.current?.files?.[0]);
    if (!current) return;
    const { file, preview } = await rotateCW(current);
    if (n === 1) { setRotated1(file); setPreview1(prev => { if (prev) URL.revokeObjectURL(prev); return preview; }); }
    else         { setRotated2(file); setPreview2(prev => { if (prev) URL.revokeObjectURL(prev); return preview; }); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const file1 = rotated1 ?? fileRef1.current?.files?.[0];
    if (!file1) { setError('Please take or select a photo'); return; }
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('photo', await compressImage(file1));
      const file2 = rotated2 ?? fileRef2.current?.files?.[0];
      if (file2) fd.append('photo2', await compressImage(file2));
      fd.append('name', form.name);
      fd.append('size', form.size);
      fd.append('bestBefore', form.bestBefore);
      fd.append('notes', form.notes);

      const res = await fetch('/api/products', { method: 'POST', body: fd });

      if (res.ok) {
        setSuccess(true);
        setPreview1(null); setPreview2(null);
        setRotated1(null); setRotated2(null);
        setForm({ name: '', size: '', bestBefore: '', notes: '' });
        if (fileRef1.current) fileRef1.current.value = '';
        if (fileRef2.current) fileRef2.current.value = '';
      } else {
        const data = await res.json();
        setError(data.error ?? 'Upload failed');
      }
    } catch {
      setError('Network error — please try again');
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <main className="success-screen">
        <div className="success-icon">✓</div>
        <h2>Product Added!</h2>
        <button onClick={() => setSuccess(false)} className="btn-primary">Add Another</button>
        <a href="/" className="btn-secondary">View Store</a>
      </main>
    );
  }

  return (
    <main className="upload-page">
      <h1>Add Product</h1>
      <form onSubmit={handleSubmit}>

        <p className="field-label" style={{ marginBottom: '0.4rem' }}>Photo 1 — front *</p>
        <label className="photo-label">
          <input ref={fileRef1} type="file" accept="image/*" capture="environment" onChange={handlePhoto(1)} required />
          {preview1
            ? <img src={preview1} alt="preview 1" className="photo-preview" />
            : <div className="photo-placeholder">📷 Tap to snap front photo</div>
          }
        </label>
        {preview1 && (
          <button type="button" className="btn-rotate" onClick={() => handleRotate(1)}>↻ Rotate</button>
        )}

        <p className="field-label" style={{ marginBottom: '0.4rem', marginTop: '1rem' }}>Photo 2 — back / side (optional)</p>
        <label className="photo-label">
          <input ref={fileRef2} type="file" accept="image/*" capture="environment" onChange={handlePhoto(2)} />
          {preview2
            ? <img src={preview2} alt="preview 2" className="photo-preview" />
            : <div className="photo-placeholder photo-placeholder-opt">📷 Tap to snap second photo</div>
          }
        </label>
        {preview2 && (
          <button type="button" className="btn-rotate" onClick={() => handleRotate(2)}>↻ Rotate</button>
        )}

        {analyzing && (
          <p style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '1rem 0 0.5rem', fontWeight: 600 }}>
            ⏳ Reading product label…
          </p>
        )}

        <input
          type="text" placeholder="Product name *" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required className="field" autoComplete="off"
          style={{ marginTop: analyzing ? '0' : '1rem', opacity: analyzing ? 0.6 : 1 }}
          disabled={analyzing}
        />
        <input
          type="text" placeholder="Size / weight  (e.g. 330ml, 500g)" value={form.size}
          onChange={e => setForm({ ...form, size: e.target.value })}
          className="field" style={{ opacity: analyzing ? 0.6 : 1 }} disabled={analyzing}
        />
        <div className="field-wrap">
          <label className="field-label">Best Before Date *</label>
          <input
            type="date" value={form.bestBefore}
            onChange={e => setForm({ ...form, bestBefore: e.target.value })}
            required className="field" style={{ marginBottom: 0, opacity: analyzing ? 0.6 : 1 }}
            disabled={analyzing}
          />
        </div>
        <textarea
          placeholder="Notes  (optional)" value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          className="field" rows={3}
        />

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || analyzing} className="btn-primary">
          {submitting ? 'Processing & uploading…' : 'Add to Store'}
        </button>
        <a href="/" className="btn-secondary" style={{ marginTop: '0.75rem' }}>← Back to Store</a>
      </form>
    </main>
  );
}
