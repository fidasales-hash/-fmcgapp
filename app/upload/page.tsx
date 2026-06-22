'use client';
import { useState, useRef, useEffect } from 'react';
import { categorize } from '@/lib/categorize';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

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
      canvas.toBlob(blob => resolve(new File([blob!], 'photo.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.95);
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
      ctx.rotate(-Math.PI / 2);
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
  label, tapLabel, compact, analyzing, onFile,
}: {
  label: string; tapLabel: string; compact?: boolean; analyzing: boolean; onFile: (file: File) => void;
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
        video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities() as Record<string, unknown>;
      if (caps.torch) {
        setTorchSupported(true);
        try {
          await track.applyConstraints({ advanced: [{ torch: true }] } as unknown as MediaTrackConstraints);
          setTorchOn(true);
        } catch { /* torch unavailable */ }
      }
      setMode('camera');
    } catch { fileRef.current?.click(); }
  }

  async function snap() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    let blob: Blob | null = null;
    try {
      const ic = new (window as unknown as { ImageCapture: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture(track);
      blob = await ic.takePhoto();
    } catch {
      const video = videoRef.current;
      if (video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      }
    }
    stopStream();
    if (!blob) return;
    const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
    setCapturedFile(file); setRotatedFile(null);
    setPreview(URL.createObjectURL(file)); setMode('preview');
    onFile(file);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints); setTorchOn(next); } catch { /* ignore */ }
  }

  async function rotate() {
    const src = rotatedFile ?? capturedFile;
    if (!src) return;
    const { file, preview: prev } = await rotateCW(src);
    setRotatedFile(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(prev); onFile(file);
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setCapturedFile(null); setRotatedFile(null);
    setTorchOn(false); setTorchSupported(false); setMode('idle'); openCamera();
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file); setRotatedFile(null);
    setPreview(URL.createObjectURL(file)); setMode('preview'); onFile(file);
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <p className="field-label" style={{ marginBottom: '0.4rem' }}>{label}</p>
      <div style={{ display: mode === 'camera' ? 'flex' : 'none', position: 'fixed', inset: 0, zIndex: 1000, flexDirection: 'column', background: '#000' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1rem', background: 'rgba(0,0,0,0.6)' }}>
          {torchSupported && (
            <button type="button" onClick={toggleTorch} style={{ background: torchOn ? '#FFD600' : 'rgba(255,255,255,0.15)', color: torchOn ? '#000' : '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
              ⚡ {torchOn ? 'Flash on' : 'Flash off'}
            </button>
          )}
          <button type="button" onClick={snap} style={{ background: '#fff', border: '5px solid rgba(255,255,255,0.4)', borderRadius: '50%', width: 72, height: 72, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem' }}>📷</button>
          <button type="button" onClick={() => { stopStream(); setMode('idle'); }} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.1rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>✕ Cancel</button>
        </div>
      </div>
      {mode === 'idle' && (
        <>
          <div className={`photo-placeholder${compact ? ' photo-placeholder-opt' : ''}`} style={{ cursor: 'pointer' }} onClick={openCamera}>📷 {tapLabel}</div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileInput} />
        </>
      )}
      {mode === 'preview' && preview && (
        <>
          <img src={preview} alt="preview" className="photo-preview" style={{ opacity: analyzing ? 0.65 : 1, transition: 'opacity 0.2s' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button type="button" className="btn-rotate" style={{ flex: 1, marginBottom: 0 }} onClick={rotate}>↺ Rotate Left</button>
            <button type="button" className="btn-rotate" style={{ flex: 1, marginBottom: 0 }} onClick={retake}>↺ Retake</button>
          </div>
        </>
      )}
    </div>
  );
}

function ImagePicker({ label, images, selected, onSelect, loading }: {
  label: string; images: string[]; selected: string | null; onSelect: (url: string | null) => void; loading?: boolean;
}) {
  if (loading) return (
    <div style={{ marginBottom: '1rem' }}>
      <p className="field-label" style={{ marginBottom: '0.4rem' }}>{label}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>⏳ Finding images…</p>
    </div>
  );
  if (!images.length) return null;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p className="field-label" style={{ marginBottom: '0.4rem' }}>{label}</p>
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {images.map((url, i) => (
          <img key={i} src={url} alt={`option ${i + 1}`} onClick={() => onSelect(selected === url ? null : url)}
            style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', flexShrink: 0, border: selected === url ? '3px solid var(--primary)' : '3px solid transparent', opacity: selected && selected !== url ? 0.45 : 1, transition: 'opacity 0.15s, border-color 0.15s' }} />
        ))}
      </div>
      {selected && (
        <button type="button" onClick={() => onSelect(null)} style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0', marginTop: '0.15rem' }}>
          ✕ Clear selection
        </button>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [file3, setFile3] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', size: '', bestBefore: '', notes: '', price: '', marketPrice: '', category: 'Other' });
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const analyzing = analyzingCount > 0;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [barcode, setBarcode] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState<'idle' | 'found' | 'notfound'>('idle');
  const [frontImages, setFrontImages] = useState<string[]>([]);
  const [backImages, setBackImages] = useState<string[]>([]);
  const [selectedFront, setSelectedFront] = useState<string | null>(null);
  const [selectedBack, setSelectedBack] = useState<string | null>(null);
  const [selectedThird, setSelectedThird] = useState<string | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);

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
            setBarcode(code);
            lookupBarcodeCode(code);
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

  async function lookupBarcodeCode(code: string) {
    if (!code) return;
    setBarcodeLoading(true);
    setBarcodeStatus('idle');
    setFrontImages([]); setBackImages([]);
    setSelectedFront(null); setSelectedBack(null);
    try {
      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: code }),
      });
      if (res.ok) {
        const data = await res.json();
        setBarcodeStatus(data.found ? 'found' : 'notfound');
        if (data.found) {
          setForm(prev => ({
            ...prev,
            name: data.name || prev.name,
            size: data.size || prev.size,
            category: data.category && data.category !== 'Other' ? data.category : prev.category,
            marketPrice: data.marketPrice ? String(data.marketPrice) : prev.marketPrice,
          }));
        }
        if (data.frontImages?.length) setFrontImages(data.frontImages);
        if (data.backImages?.length) setBackImages(data.backImages);
      }
    } catch { /* silent */ }
    setBarcodeLoading(false);
  }

  async function fetchImages(name: string, size: string) {
    if (!name || frontImages.length) return;
    setImagesLoading(true);
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, size }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.frontImages?.length) setFrontImages(data.frontImages);
        if (data.backImages?.length) setBackImages(data.backImages);
      }
    } catch { /* silent */ }
    setImagesLoading(false);
  }

  async function analyzePhoto(file: File, fillEmptyOnly = false) {
    if (localStorage.getItem('claudeApiEnabled') === 'false') return;
    setAnalyzingCount(c => c + 1);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => {
          const name = fillEmptyOnly ? (prev.name || data.name) : (data.name || prev.name);
          const aiCategory = CATEGORIES.includes(data.category) ? data.category : (name ? categorize(name) : '');
          return {
            name,
            size:        fillEmptyOnly ? (prev.size || data.size) : (data.size || prev.size),
            bestBefore:  prev.bestBefore,
            notes:       prev.notes,
            price:       prev.price,
            marketPrice: prev.marketPrice,
            category:    prev.category === 'Other' && aiCategory ? aiCategory : prev.category,
          };
        });
        if (data.name) fetchImages(data.name, data.size || '');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(`Label reading failed: ${data.error ?? res.status} — fill in manually`);
      }
    } catch {
      setError('Label reading failed — fill in manually');
    }
    setAnalyzingCount(c => c - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file1 && !selectedFront) { setError('Please select or take a front photo'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (selectedFront) { fd.append('photo1Url', selectedFront); }
      else if (file1) { fd.append('photo', await compressImage(file1)); }
      if (selectedBack) { fd.append('photo2Url', selectedBack); }
      else if (file2) { fd.append('photo2', await compressImage(file2)); }
      if (selectedThird) { fd.append('photo3Url', selectedThird); }
      else if (file3) { fd.append('photo3', await compressImage(file3)); }
      fd.append('name', form.name);
      fd.append('size', form.size);
      fd.append('bestBefore', form.bestBefore);
      fd.append('notes', form.notes);
      fd.append('price', form.price);
      fd.append('marketPrice', form.marketPrice);
      fd.append('category', form.category);
      const res = await fetch('/api/products', { method: 'POST', body: fd });
      if (res.ok) {
        setSuccess(true);
        setFile1(null); setFile2(null); setFile3(null);
        setBarcode(''); setBarcodeStatus('idle');
        setFrontImages([]); setBackImages([]);
        setSelectedFront(null); setSelectedBack(null); setSelectedThird(null);
        setForm({ name: '', size: '', bestBefore: '', notes: '', price: '', marketPrice: '', category: 'Other' });
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

        {/* Barcode scanner overlay */}
        {scanning && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#000' }}>
            <video ref={scanVideoRef} autoPlay playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
            {/* Viewfinder */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', width: '78%', height: 90, border: '3px solid #fff', borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }} />
            <p style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, calc(-60% + 106px))', color: '#fff', fontSize: '0.9rem', textAlign: 'center', width: '80%', margin: 0 }}>
              Aim barcode at the box
            </p>
            <div style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center' }}>
              <button type="button" onClick={stopScan} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.5rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>✕ Cancel</button>
            </div>
          </div>
        )}

        {/* Barcode input */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label className="field-label">Barcode</label>
          {scanSupported && (
            <button type="button" onClick={startScan} disabled={barcodeLoading} className="btn-primary"
              style={{ width: '100%', marginBottom: '0.5rem' }}>
              📷 Scan Barcode
            </button>
          )}
          <input
            type="text" inputMode="numeric" placeholder="or type barcode number"
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupBarcodeCode(barcode.trim()); } }}
            className="field" style={{ marginBottom: '0.5rem' }}
            disabled={barcodeLoading}
          />
          <button type="button" onClick={() => lookupBarcodeCode(barcode.trim())} disabled={!barcode.trim() || barcodeLoading}
            className="btn-primary" style={{ width: '100%', marginBottom: 0 }}>
            {barcodeLoading ? '…' : 'Look Up'}
          </button>
          {barcodeStatus === 'found' && <p style={{ color: 'var(--green)', fontSize: '0.85rem', marginTop: '0.3rem', fontWeight: 600 }}>✓ {form.name || 'Product found'}{form.size ? ` — ${form.size}` : ''}</p>}
          {barcodeStatus === 'notfound' && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>Not found — fill in manually or take photos below</p>}
        </div>

        {/* Online image pickers */}
        <ImagePicker label="Front image — tap to select" images={frontImages} selected={selectedFront} onSelect={setSelectedFront} loading={imagesLoading} />
        <ImagePicker label="Back label — tap to select (optional)" images={backImages} selected={selectedBack} onSelect={setSelectedBack} />

        {/* Camera slots */}
        <CameraSlot
          label={frontImages.length ? 'Or take your own front photo *' : 'Photo 1 — front *'}
          tapLabel="Tap to open camera"
          analyzing={analyzing}
          onFile={file => { setFile1(file); analyzePhoto(file); }}
        />
        <CameraSlot
          label={backImages.length ? 'Or take your own back photo (optional)' : 'Photo 2 — back / side (optional)'}
          tapLabel="Tap to open camera"
          compact
          analyzing={analyzing}
          onFile={file => { setFile2(file); analyzePhoto(file, true); }}
        />
        <CameraSlot
          label="Photo 3 — extra view (optional)"
          tapLabel="Tap to open camera"
          compact
          analyzing={analyzing}
          onFile={file => setFile3(file)}
        />

        {analyzing && (
          <p style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '0.25rem 0 0.75rem', fontWeight: 600 }}>
            ⏳ Reading product label…
          </p>
        )}

        <input type="text" placeholder="Product name *" value={form.name}
          onChange={e => { const v = e.target.value; setForm(f => ({ ...f, name: v })); }}
          required className="field" autoComplete="off" style={{ opacity: analyzing ? 0.6 : 1 }} disabled={analyzing} />
        <input type="text" placeholder="Size / weight  (e.g. 330ml, 500g)" value={form.size}
          onChange={e => { const v = e.target.value; setForm(f => ({ ...f, size: v })); }}
          className="field" style={{ opacity: analyzing ? 0.6 : 1 }} disabled={analyzing} />
        <div className="field-wrap">
          <label className="field-label">Category</label>
          <select className="field" style={{ marginBottom: 0, appearance: 'auto' }} value={form.category} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, category: v })); }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field-wrap">
          <label className="field-label">Price (R) *</label>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price}
            onChange={e => { const v = e.target.value; setForm(f => ({ ...f, price: v })); }}
            required className="field" style={{ marginBottom: 0 }} />
        </div>
        <div className="field-wrap">
          <label className="field-label">
            Market Price (R)
            {form.marketPrice
              ? <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600 }}>● found online</span>
              : <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--muted)' }}>optional</span>}
          </label>
          <input type="number" min="0" step="0.01" placeholder="0.00" value={form.marketPrice}
            onChange={e => { const v = e.target.value; setForm(f => ({ ...f, marketPrice: v })); }}
            className="field" style={{ marginBottom: 0 }} />
        </div>
        <div className="field-wrap">
          <label className="field-label">Best Before</label>
          <input type="date" className="field" value={form.bestBefore} style={{ marginBottom: 0 }}
            onChange={e => { const v = e.target.value; setForm(f => ({ ...f, bestBefore: v })); }} />
        </div>
        <textarea placeholder="Notes  (optional)" value={form.notes}
          onChange={e => { const v = e.target.value; setForm(f => ({ ...f, notes: v })); }}
          className="field" rows={3} />

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || analyzing} className="btn-primary">
          {submitting ? 'Processing & uploading…' : 'Add to Store'}
        </button>
        <a href="/" className="btn-secondary" style={{ marginTop: '0.75rem' }}>← Back to Store</a>
      </form>
    </main>
  );
}
