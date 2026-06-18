'use client';
import { useState, useRef, useEffect } from 'react';

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
      canvas.width = img.height; canvas.height = img.width;
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

type SlotMode = 'idle' | 'camera' | 'preview';

function CameraSlot({
  label,
  tapLabel,
  compact,
  analyzing,
  onFile,
}: {
  label: string;
  tapLabel: string;
  compact?: boolean;
  analyzing: boolean;
  onFile: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<SlotMode>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [rotatedFile, setRotatedFile] = useState<File | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => () => stopStream(), []);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // auto-enable torch
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities() as Record<string, unknown>;
      if (caps.torch) {
        setTorchSupported(true);
        try {
          await track.applyConstraints({ advanced: [{ torch: true }] } as unknown as MediaTrackConstraints);
          setTorchOn(true);
        } catch { /* torch unavailable on this device */ }
      }
      setMode('camera');
    } catch {
      fileRef.current?.click(); // fallback for devices that block getUserMedia
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    stopStream();
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      setCapturedFile(file);
      setRotatedFile(null);
      setPreview(URL.createObjectURL(file));
      setMode('preview');
      onFile(file);
    }, 'image/jpeg', 0.92);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch { /* ignore */ }
  }

  async function rotate() {
    const src = rotatedFile ?? capturedFile;
    if (!src) return;
    const { file, preview: prev } = await rotateCW(src);
    setRotatedFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(prev);
    onFile(file);
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedFile(null);
    setRotatedFile(null);
    setTorchOn(false);
    setTorchSupported(false);
    setMode('idle');
    openCamera();
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file);
    setRotatedFile(null);
    setPreview(URL.createObjectURL(file));
    setMode('preview');
    onFile(file);
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <p className="field-label" style={{ marginBottom: '0.4rem' }}>{label}</p>

      {/* always in DOM so videoRef is ready before setMode('camera') */}
      <div style={{
        position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden',
        background: '#111', display: mode === 'camera' ? 'block' : 'none',
      }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
        <div style={{
          position: 'absolute', bottom: '0.75rem', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem',
        }}>
          {torchSupported && (
            <button type="button" onClick={toggleTorch} style={{
              background: torchOn ? '#FFD600' : 'rgba(0,0,0,0.55)',
              color: torchOn ? '#000' : '#fff',
              border: 'none', borderRadius: 8,
              padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
            }}>
              ⚡ {torchOn ? 'Flash on' : 'Flash off'}
            </button>
          )}
          <button type="button" onClick={snap} style={{
            background: '#fff', border: '4px solid rgba(255,255,255,0.45)',
            borderRadius: '50%', width: 64, height: 64, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
          }}>📷</button>
        </div>
      </div>

      {mode === 'idle' && (
        <>
          <div
            className={`photo-placeholder${compact ? ' photo-placeholder-opt' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={openCamera}
          >
            📷 {tapLabel}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={handleFileInput} />
        </>
      )}

      {mode === 'preview' && preview && (
        <>
          <img src={preview} alt="preview" className="photo-preview"
            style={{ opacity: analyzing ? 0.65 : 1, transition: 'opacity 0.2s' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button type="button" className="btn-rotate" style={{ flex: 1, marginBottom: 0 }} onClick={rotate}>↻ Rotate</button>
            <button type="button" className="btn-rotate" style={{ flex: 1, marginBottom: 0 }} onClick={retake}>↺ Retake</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', size: '', bestBefore: '', notes: '' });
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const analyzing = analyzingCount > 0;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function analyzePhoto(file: File) {
    setAnalyzingCount(c => c + 1);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({
          name:       data.name       || prev.name,
          size:       data.size       || prev.size,
          bestBefore: data.bestBefore || prev.bestBefore,
          notes:      prev.notes,
        }));
      }
    } catch { /* silently fail — staff can fill in manually */ }
    setAnalyzingCount(c => c - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file1) { setError('Please take a photo first'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('photo', await compressImage(file1));
      if (file2) fd.append('photo2', await compressImage(file2));
      fd.append('name', form.name);
      fd.append('size', form.size);
      fd.append('bestBefore', form.bestBefore);
      fd.append('notes', form.notes);
      const res = await fetch('/api/products', { method: 'POST', body: fd });
      if (res.ok) {
        setSuccess(true);
        setFile1(null); setFile2(null);
        setForm({ name: '', size: '', bestBefore: '', notes: '' });
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

        <CameraSlot
          label="Photo 1 — front *"
          tapLabel="Tap to open camera"
          analyzing={analyzing}
          onFile={file => { setFile1(file); analyzePhoto(file); }}
        />

        <CameraSlot
          label="Photo 2 — back / side (optional)"
          tapLabel="Tap to open camera"
          compact
          analyzing={analyzing}
          onFile={file => { setFile2(file); analyzePhoto(file); }}
        />

        {analyzing && (
          <p style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '0.25rem 0 0.75rem', fontWeight: 600 }}>
            ⏳ Reading product label…
          </p>
        )}

        <input
          type="text" placeholder="Product name *" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required className="field" autoComplete="off"
          style={{ opacity: analyzing ? 0.6 : 1 }} disabled={analyzing}
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
