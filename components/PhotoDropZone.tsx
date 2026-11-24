'use client';
import { useState, useRef } from 'react';

// Photo box: click to browse, drag and drop. Used by the Edit photos and Add photos panels.
export default function DropZone({ preview, label, onFile, onClear }: { preview: string; label: string; onFile: (f: File) => void; onClear?: () => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const enterCount = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    enterCount.current++;
    setDragging(true);
  }

  function handleDragLeave() {
    enterCount.current--;
    if (enterCount.current === 0) setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    enterCount.current = 0;
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) onFile(f);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
          border: preview
            ? `0.5px solid var(--border, #ddd)`
            : `1.5px dashed ${dragging ? 'var(--primary, #2563eb)' : 'var(--border, #ddd)'}`,
          background: dragging ? 'rgba(37,99,235,0.05)' : preview ? 'transparent' : 'var(--surface, #f9f9f9)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, position: 'relative', transition: 'border-color 0.15s',
        }}
      >
        {preview ? (
          <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        ) : (
          <>
            <span style={{ fontSize: '1.25rem', color: '#ccc', pointerEvents: 'none' }}>+</span>
            <span style={{ fontSize: '0.68rem', color: '#bbb', pointerEvents: 'none' }}>{dragging ? 'Drop' : label}</span>
          </>
        )}
        {dragging && preview && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(37,99,235,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary, #2563eb)', fontWeight: 600 }}>Drop</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {preview && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--primary, #2563eb)', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>Replace</span>
          {onClear && (
            <span style={{ fontSize: '0.7rem', color: '#bbb', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onClear(); }}>· Remove</span>
          )}
        </div>
      )}
      {!preview && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#bbb' }}>{label}</span>
        </div>
      )}
    </div>
  );
}
