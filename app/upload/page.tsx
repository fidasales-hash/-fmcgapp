'use client';
import { useState, useRef, useEffect } from 'react';
import { categorize } from '@/lib/categorize';
import { CameraSlot, compressImage } from '@/components/CameraSlot';

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

const MIN_IMAGE_PX = 500;

function ImagePicker({ label, subtitle, onUseSource, images, picked, onToggle, onClearRow, loading }: {
  label: string; subtitle?: string; onUseSource?: () => void; images: string[]; picked: string[]; onToggle: (url: string) => void; onClearRow: () => void; loading?: boolean;
}) {
  const [approved, setApproved] = useState<string[]>([]);

  useEffect(() => {
    setApproved([]);
    images.forEach(url => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth >= MIN_IMAGE_PX || img.naturalHeight >= MIN_IMAGE_PX) {
          setApproved(prev => prev.includes(url) ? prev : [...prev, url]);
        }
      };
      img.src = url;
    });
  }, [images]);

  if (loading) return (
    <div style={{ marginBottom: '1rem' }}>
      <p className="field-label" style={{ marginBottom: '0.4rem' }}>{label}</p>
      <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>⏳ Finding images…</p>
    </div>
  );
  if (!images.length) return null;
  if (!approved.length) return null;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <p className="field-label" style={{ marginBottom: subtitle ? '0.1rem' : '0.4rem' }}>{label}</p>
      {subtitle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.4rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0, flex: 1 }}>{subtitle}</p>
          {onUseSource && <button type="button" onClick={onUseSource} style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: '1px solid var(--primary)', borderRadius: 4, padding: '0.1rem 0.45rem', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Use</button>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {approved.map((url, i) => {
          const slot = picked.indexOf(url);
          const isPicked = slot >= 0;
          return (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              <img src={url} alt={`option ${i + 1}`} onClick={() => onToggle(url)}
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', display: 'block', border: isPicked ? '3px solid var(--primary)' : '3px solid transparent', transition: 'border-color 0.15s' }} />
              {isPicked && (
                <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {slot + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {approved.some(url => picked.includes(url)) && (
        <button type="button" onClick={onClearRow} style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0', marginTop: '0.15rem' }}>
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
  const [paste1, setPaste1] = useState<File | null>(null);
  const [paste2, setPaste2] = useState<File | null>(null);
  const [paste3, setPaste3] = useState<File | null>(null);
  const [form, setForm] = useState({ name: '', size: '', bestBefore: '', notes: '', price: '', marketPrice: '', category: 'Other' });
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const analyzing = analyzingCount > 0;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [barcode, setBarcode] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState<'idle' | 'found' | 'notfound'>('idle');
  const [barcodeDuplicate, setBarcodeDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [serperImgs, setSerperImgs] = useState<string[]>([]);
  const [offImgs, setOffImgs] = useState<string[]>([]);
  const [upcImgs, setUpcImgs] = useState<string[]>([]);
  const [serperSource, setSerperSource] = useState({ name: '' });
  const [offSource, setOffSource] = useState({ name: '', size: '', category: '' });
  const [upcSource, setUpcSource] = useState({ name: '', size: '', category: '' });
  const [marketPriceSource, setMarketPriceSource] = useState('');
  const [pickedImages, setPickedImages] = useState<string[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [groqAnalyzing, setGroqAnalyzing] = useState(false);
  const [sizeOverride, setSizeOverride] = useState(false);
  const firstPickedImage = pickedImages[0];

  const [kosher, setKosher] = useState(false);
  const [halal, setHalal] = useState(false);
  const [vegan, setVegan] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanSupported, setScanSupported] = useState(false);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setScanSupported('BarcodeDetector' in window);
    return () => stopScan();
  }, []);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      if (!file1) { setPaste1(file); return; }
      if (!file2) { setPaste2(file); return; }
      if (!file3) { setPaste3(file); }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [file1, file2, file3]);

  useEffect(() => {
    if (!firstPickedImage) return;
    if (localStorage.getItem('claudeApiEnabled') === 'false') return;
    if (form.name) return;
    setGroqAnalyzing(true);
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoUrl: firstPickedImage }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || data.error) return;
        setForm(prev => {
          const aiCategory = CATEGORIES.includes(data.category) ? data.category : '';
          return {
            ...prev,
            name: data.name || prev.name,
            size: data.size || prev.size,
            category: aiCategory || prev.category,
            marketPrice: prev.marketPrice || (data.marketPrice ? String(data.marketPrice) : ''),
          };
        });
      })
      .catch(() => {})
      .finally(() => setGroqAnalyzing(false));
  }, [firstPickedImage]);

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
    setBarcodeDuplicate(null);
    setSerperImgs([]); setOffImgs([]); setUpcImgs([]);
    setPickedImages([]);
    try {
      const res = await fetch('/api/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: code }),
      });
      if (res.ok) {
        const data = await res.json();
        setBarcodeStatus(data.found ? 'found' : 'notfound');
        if (data.duplicate) setBarcodeDuplicate(data.duplicate);
        if (data.found) {
          setForm(prev => ({
            ...prev,
            name: data.name || prev.name,
            size: data.size || prev.size,
            category: (data.category && CATEGORIES.includes(data.category)) ? data.category : prev.category,
            marketPrice: data.marketPrice ? String(data.marketPrice) : prev.marketPrice,
          }));
          if (data.marketPriceSource) setMarketPriceSource(data.marketPriceSource);
        }
        const s = data.sources ?? {};
        setSerperImgs(s.serper?.images ?? []);
        setOffImgs(s.off?.images ?? []);
        setUpcImgs(s.upc?.images ?? []);
        setSerperSource({ name: s.serper?.name ?? '' });
        setOffSource({ name: s.off?.name ?? '', size: s.off?.size ?? '', category: s.off?.category ?? '' });
        setUpcSource({ name: s.upc?.name ?? '', size: s.upc?.size ?? '', category: s.upc?.category ?? '' });
      }
    } catch { /* silent */ }
    setBarcodeLoading(false);
  }

  async function fetchImages(name: string, size: string) {
    if (!name || serperImgs.length) return;
    setImagesLoading(true);
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, size }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.frontImages?.length) setSerperImgs(data.frontImages);
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

  function clearForm() {
    setFile1(null); setFile2(null); setFile3(null);
    setPaste1(null); setPaste2(null); setPaste3(null);
    setBarcode(''); setBarcodeStatus('idle'); setBarcodeLoading(false); setBarcodeDuplicate(null);
    setSerperImgs([]); setOffImgs([]); setUpcImgs([]);
    setSerperSource({ name: '' }); setOffSource({ name: '', size: '', category: '' }); setUpcSource({ name: '', size: '', category: '' });
    setMarketPriceSource('');
    setPickedImages([]);
    setImagesLoading(false);
    setForm({ name: '', size: '', bestBefore: '', notes: '', price: '', marketPrice: '', category: 'Other' });
    setSizeOverride(false);
    setKosher(false); setHalal(false); setVegan(false);
    setError('');
    stopScan();
  }

  const SIZE_RE = /^(\d+(\.\d+)?\s*(ml|g|l|kg)(\s*x\s*\d+(\.\d+)?\s*(ml|g|l|kg))?|\d+'?s)$/i;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file1 && !pickedImages[0]) { setError('Please select or take a front photo'); return; }
    if (barcodeDuplicate) { setError(`Barcode already in store — "${barcodeDuplicate.name}"`); return; }
    if (!form.size.trim()) { setError("Size / weight is required (e.g. 330ml, 500g, 2L, 1kg, 10's)"); return; }
    if (!sizeOverride && !SIZE_RE.test(form.size.trim())) { setError("Size must be a number with unit — e.g. 330ml, 500g, 2L, 1.5kg, 6 x 330ml, 10's"); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (pickedImages[0]) { fd.append('photo1Url', pickedImages[0]); }
      else if (file1) { fd.append('photo', await compressImage(file1)); }
      if (pickedImages[1]) { fd.append('photo2Url', pickedImages[1]); }
      else if (file2) { fd.append('photo2', await compressImage(file2)); }
      if (pickedImages[2]) { fd.append('photo3Url', pickedImages[2]); }
      else if (file3) { fd.append('photo3', await compressImage(file3)); }
      fd.append('name', form.name);
      fd.append('size', form.size);
      fd.append('bestBefore', form.bestBefore);
      fd.append('notes', form.notes);
      fd.append('price', form.price);
      fd.append('marketPrice', form.marketPrice);
      fd.append('category', form.category);
      fd.append('barcode', barcode);
      fd.append('kosher', kosher ? 'true' : 'false');
      fd.append('halal', halal ? 'true' : 'false');
      fd.append('vegan', vegan ? 'true' : 'false');
      const res = await fetch('/api/products', { method: 'POST', body: fd });
      if (res.ok) {
        setSuccess(true);
        setFile1(null); setFile2(null); setFile3(null);
        setBarcode(''); setBarcodeStatus('idle');
        setSerperImgs([]); setOffImgs([]); setUpcImgs([]);
        setSerperSource({ name: '' }); setOffSource({ name: '', size: '', category: '' }); setUpcSource({ name: '', size: '', category: '' });
        setMarketPriceSource('');
        setPickedImages([]);
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

  function toggleImage(url: string) {
    setPickedImages(prev =>
      prev.includes(url) ? prev.filter(u => u !== url) : prev.length < 3 ? [...prev, url] : prev
    );
  }

  const TITLE_SIZE_RE = /\b\d+(\.\d+)?[-\s]*(ml|g|l|kg|cl|oz|lb|lbs|fl\.?\s*oz)\.?(\s*x\s*\d+(\.\d+)?\s*(ml|g|l|kg))?\b/gi;

  function extractSizeFromTitle(raw: string): string {
    const match = raw.match(TITLE_SIZE_RE);
    if (!match) return '';
    return match[0].replace(/[-\s.]/g, '').toLowerCase();
  }

  function cleanProductName(raw: string): string {
    const FILLER = /\b(product|food|brand|original|classic|regular|standard|item|goods)\b/gi;
    return raw
      // strip ", from X" patterns
      .replace(/,?\s*from\s+.*/gi, '')
      // strip store name suffixes
      .replace(/\s*[-|:–]\s*(checkers|pick\s*n?\s*pay|pnp|woolworths|shoprite|makro|spar|clicks|dis[- ]?chem|takealot|amazon|walmart|target|google|bing|yahoo|macy|nordstrom|www\.|[a-z]+\.(co|com|za))[^\n]*/gi, '')
      // strip parentheticals unless they contain flavour/variant keywords
      .replace(/\([^)]*\)/g, s => /sugar|salt|fat|free|lite|light|flavou?r|variant|original|reduced|low/i.test(s) ? s : '')
      // strip size from name (already in size field)
      .replace(TITLE_SIZE_RE, '')
      // remove filler words
      .replace(FILLER, '')
      // clean punctuation — remove commas, periods, quotes, semicolons, !, ®, ™
      .replace(/[®™.,;:!"'`]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      // title case — lowercase first so ALL CAPS titles get fixed
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase())
      // max 6 words
      .split(/\s+/).slice(0, 6).join(' ');
  }

  function applySource(source: { name?: string; size?: string; category?: string }) {
    const cleanName = source.name ? cleanProductName(source.name) : '';
    const extractedSize = !source.size && source.name ? extractSizeFromTitle(source.name) : '';
    setForm(f => ({
      ...f,
      ...(cleanName ? { name: cleanName } : {}),
      ...(source.size ? { size: source.size } : extractedSize ? { size: extractedSize } : {}),
      ...(source.category && CATEGORIES.includes(source.category) ? { category: source.category } : {}),
    }));
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h1 style={{ margin: 0 }}>Add Product</h1>
        <button type="button" onClick={clearForm} style={{ background: 'none', border: '1.5px solid var(--muted)', borderRadius: 8, padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Clear</button>
      </div>
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
          {barcodeStatus === 'found' && !barcodeDuplicate && <p style={{ color: 'var(--green)', fontSize: '0.85rem', marginTop: '0.3rem', fontWeight: 600 }}>✓ {form.name || 'Product found'}{form.size ? ` — ${form.size}` : ''}</p>}
          {barcodeStatus === 'notfound' && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>Not found — fill in manually or take photos below</p>}
          {barcodeDuplicate && <p style={{ color: '#c00', fontSize: '0.85rem', marginTop: '0.3rem', fontWeight: 600 }}>⚠ Already in store — "{barcodeDuplicate.name}"</p>}
        </div>

        {/* Image source comparison — tap up to 3 images; badges show which slot (1/2/3) each fills */}
        <ImagePicker label="Google Images (Serper)" subtitle={serperSource.name || undefined} onUseSource={!form.name && !groqAnalyzing && pickedImages.length > 0 && serperSource.name ? () => applySource(serperSource) : undefined} images={serperImgs} picked={pickedImages} onToggle={toggleImage} onClearRow={() => setPickedImages(p => p.filter(u => !serperImgs.includes(u)))} loading={imagesLoading} />
        <ImagePicker label="Open Food Facts" subtitle={[offSource.name, offSource.size].filter(Boolean).join(' ') || undefined} onUseSource={!form.name && !groqAnalyzing && pickedImages.length > 0 && offSource.name ? () => applySource(offSource) : undefined} images={offImgs} picked={pickedImages} onToggle={toggleImage} onClearRow={() => setPickedImages(p => p.filter(u => !offImgs.includes(u)))} />
        <ImagePicker label="UPCitemdb" subtitle={[upcSource.name, upcSource.size].filter(Boolean).join(' ') || undefined} onUseSource={!form.name && !groqAnalyzing && pickedImages.length > 0 && upcSource.name ? () => applySource(upcSource) : undefined} images={upcImgs} picked={pickedImages} onToggle={toggleImage} onClearRow={() => setPickedImages(p => p.filter(u => !upcImgs.includes(u)))} />

        {/* Camera slots */}
        <CameraSlot
          label={serperImgs.length || offImgs.length || upcImgs.length ? `Or take your own front photo${pickedImages[0] ? ' (slot 1 filled)' : ' *'}` : 'Photo 1 — front *'}
          tapLabel="Tap to open camera"
          analyzing={analyzing}
          onFile={file => { setFile1(file); analyzePhoto(file); }}
          pendingFile={paste1}
        />
        <CameraSlot
          label="Photo 2 — back / side (optional)"
          tapLabel="Tap to open camera"
          compact
          analyzing={analyzing}
          onFile={file => { setFile2(file); analyzePhoto(file, true); }}
          pendingFile={paste2}
        />
        <CameraSlot
          label="Photo 3 — best before date (optional)"
          tapLabel="Tap to photograph date"
          compact
          analyzing={analyzing}
          onFile={async file => {
            setFile3(file);
            try {
              const fd = new FormData();
              fd.append('photo', file);
              const res = await fetch('/api/analyze-date', { method: 'POST', body: fd });
              if (res.ok) {
                const data = await res.json();
                if (data.bestBefore) setForm(f => ({ ...f, bestBefore: data.bestBefore }));
              }
            } catch { /* silent */ }
          }}
          pendingFile={paste3}
        />

        {analyzing && (
          <p style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '0.25rem 0 0.75rem', fontWeight: 600 }}>
            ⏳ Reading product label…
          </p>
        )}
        {groqAnalyzing && !analyzing && (
          <p style={{ fontSize: '0.85rem', color: 'var(--primary)', margin: '0.25rem 0 0.75rem', fontWeight: 600 }}>
            ⏳ Reading selected image…
          </p>
        )}

        <input type="text" placeholder="Product name *" value={form.name}
          onChange={e => { const v = e.target.value; setForm(f => ({ ...f, name: v })); }}
          required className="field" autoComplete="off" style={{ opacity: analyzing ? 0.6 : 1 }} disabled={analyzing} />
        {form.name && firstPickedImage && !groqAnalyzing && (
          <button type="button" onClick={() => {
            setGroqAnalyzing(true);
            fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoUrl: firstPickedImage }) })
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                if (!data || data.error) return;
                setForm(prev => {
                  const aiCategory = CATEGORIES.includes(data.category) ? data.category : '';
                  return { ...prev, name: data.name || prev.name, size: data.size || prev.size, category: aiCategory || prev.category };
                });
              })
              .catch(() => {})
              .finally(() => setGroqAnalyzing(false));
          }} style={{ fontSize: '0.78rem', color: 'var(--primary)', background: 'none', border: '1px solid var(--primary)', borderRadius: 4, padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 600, marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
            {groqAnalyzing ? '⏳ Reading…' : '✦ Improve with AI'}
          </button>
        )}
        <input type="text" placeholder={sizeOverride ? "Size / weight * (any format)" : "Size / weight * (e.g. 330ml, 500g, 2L, 1kg, 10's)"} value={form.size}
          onChange={e => { const v = e.target.value; setForm(f => ({ ...f, size: v })); }}
          required className="field" style={{ opacity: analyzing ? 0.6 : 1, marginBottom: '0.25rem' }} disabled={analyzing} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={sizeOverride} onChange={e => setSizeOverride(e.target.checked)} style={{ cursor: 'pointer' }} />
          Custom format (e.g. Assorted, Various)
        </label>
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
              ? <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--green)', fontWeight: 600 }}>● {marketPriceSource ? `via ${marketPriceSource}` : 'found online'}</span>
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

        <div style={{ marginBottom: '0.75rem' }}>
          <label className="field-label">Dietary / Certification</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {([['halal', '☪ Halal', '#16a34a'], ['kosher', '✡ Kosher', '#2563eb'], ['vegan', '🌱 Vegan', '#15803d']] as const).map(([key, label, color]) => {
              const on = key === 'halal' ? halal : key === 'kosher' ? kosher : vegan;
              const set = key === 'halal' ? setHalal : key === 'kosher' ? setKosher : setVegan;
              return (
                <button key={key} type="button" onClick={() => set(!on)}
                  style={{ padding: '0.35rem 0.85rem', borderRadius: 20, border: `1.5px solid ${color}`, background: on ? color : 'transparent', color: on ? '#fff' : color, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || analyzing} className="btn-primary">
          {submitting ? 'Processing & uploading…' : 'Add to Store'}
        </button>
        <a href="/" className="btn-secondary" style={{ marginTop: '0.75rem' }}>← Back to Store</a>
      </form>
    </main>
  );
}
