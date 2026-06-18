'use client';
import { useState, useRef } from 'react';

async function clientCompressImage(file: File): Promise<File> {
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
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        resolve(new File([blob!], 'photo.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.82);
    };
    img.src = url;
  });
}

export default function UploadPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', size: '', bestBefore: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Please take or select a photo'); return; }
    setSubmitting(true);

    try {
      const compressed = await clientCompressImage(file);
      const fd = new FormData();
      fd.append('photo', compressed);
      fd.append('name', form.name);
      fd.append('size', form.size);
      fd.append('bestBefore', form.bestBefore);
      fd.append('notes', form.notes);

      const res = await fetch('/api/products', {
        method: 'POST',
        body: fd,
      });

      if (res.ok) {
        setSuccess(true);
        setPreview(null);
        setForm({ name: '', size: '', bestBefore: '', notes: '' });
        if (fileRef.current) fileRef.current.value = '';
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

        <label className="photo-label">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            required
          />
          {preview
            ? <img src={preview} alt="preview" className="photo-preview" />
            : <div className="photo-placeholder">📷 Tap to snap photo</div>
          }
        </label>

        <input
          type="text"
          placeholder="Product name *"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
          className="field"
          autoComplete="off"
        />

        <input
          type="text"
          placeholder="Size / weight  (e.g. 330ml, 500g)"
          value={form.size}
          onChange={e => setForm({ ...form, size: e.target.value })}
          className="field"
        />

        <div className="field-wrap">
          <label className="field-label">Best Before Date *</label>
          <input
            type="date"
            value={form.bestBefore}
            onChange={e => setForm({ ...form, bestBefore: e.target.value })}
            required
            className="field"
            style={{ marginBottom: 0 }}
          />
        </div>

        <textarea
          placeholder="Notes  (optional — e.g. slight dent in packaging)"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          className="field"
          rows={3}
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Processing & uploading…' : 'Add to Store'}
        </button>

        <a href="/" className="btn-secondary" style={{ marginTop: '0.75rem' }}>← Back to Store</a>
      </form>
    </main>
  );
}
