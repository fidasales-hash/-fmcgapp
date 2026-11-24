'use client';
import { useState, useRef, useEffect } from 'react';

export async function compressImage(file: File): Promise<File> {
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

export async function rotateCW(file: File): Promise<{ file: File; preview: string }> {
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

export function CameraSlot({
  label, tapLabel, compact, tile, analyzing, onFile, pendingFile,
}: {
  label: string; tapLabel: string; compact?: boolean;
  // Small square tile, for laying several slots out in a row.
  tile?: boolean;
  analyzing: boolean; onFile: (file: File) => void; pendingFile?: File | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<SlotMode>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [rotatedFile, setRotatedFile] = useState<File | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => stopStream(), []);

  useEffect(() => {
    if (!pendingFile || mode !== 'idle') return;
    setCapturedFile(pendingFile); setRotatedFile(null);
    setPreview(URL.createObjectURL(pendingFile)); setMode('preview'); onFile(pendingFile);
  }, [pendingFile]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setCapturedFile(file); setRotatedFile(null);
    setPreview(URL.createObjectURL(file)); setMode('preview'); onFile(file);
  }

  return (
    <div style={{ marginBottom: tile ? 0 : '1rem', minWidth: 0 }}>
      <p className="field-label" style={{ marginBottom: '0.4rem', ...(tile ? { fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}>{label}</p>
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
          <div
            className={`photo-placeholder${compact ? ' photo-placeholder-opt' : ''}`}
            style={{ ...(tile ? { height: 'auto', aspectRatio: '1', padding: '0.4rem', justifyContent: 'center' } : {}), cursor: 'pointer', border: dragging ? '2px dashed var(--primary)' : undefined, background: dragging ? 'var(--surface)' : undefined, transition: 'border 0.15s, background 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragEnter={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {dragging ? <span>⬇ Drop{tile ? '' : ' image here'}</span> : tile ? (
              <>
                <button type="button" onClick={openCamera} aria-label={tapLabel} title={tapLabel} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.7rem', fontSize: '1.2rem', cursor: 'pointer' }}>📷</button>
                <button type="button" onClick={() => browseRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>📁 Browse</button>
              </>
            ) : (
              <>
                <button type="button" onClick={openCamera} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>📷 {tapLabel}</button>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  <button type="button" onClick={() => browseRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>📁 Browse</button>
                  <span>· Drag &amp; drop ·</span>
                  <span>Ctrl+V Paste</span>
                </div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileInput} />
          <input ref={browseRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
        </>
      )}
      {mode === 'preview' && preview && (
        <>
          <img src={preview} alt="preview" className="photo-preview" style={{ opacity: analyzing ? 0.65 : 1, transition: 'opacity 0.2s', ...(tile ? { aspectRatio: '1', maxHeight: 'none', borderColor: 'var(--green)' } : {}) }} />
          <div style={{ display: 'flex', gap: tile ? '0.25rem' : '0.5rem', marginTop: '0.4rem' }}>
            <button type="button" className="btn-rotate" style={{ flex: 1, marginBottom: 0, ...(tile ? { padding: '0.3rem 0', fontSize: '0.75rem' } : {}) }} onClick={rotate} title="Rotate left">↺{tile ? '' : ' Rotate Left'}</button>
            <button type="button" className="btn-rotate" style={{ flex: 1, marginBottom: 0, ...(tile ? { padding: '0.3rem 0', fontSize: '0.75rem' } : {}) }} onClick={retake} title="Retake">{tile ? '✕' : '↺ Retake'}</button>
          </div>
        </>
      )}
    </div>
  );
}
