'use client';
import { useState, useRef, type MutableRefObject } from 'react';

// Photo box: click to browse, or drag a photo onto it. Used by the Edit photos
// and Add photos panels. `main` = the big main photo: shows a "Click to replace"
// cover on hover and a "Drop to replace" frame while dragging; its Replace button
// lives in the panel (browseRef lets the panel open this box's file picker).
export default function DropZone({ preview, label, onFile, onClear, main, browseRef }: {
  preview: string;
  label: string;
  onFile: (f: File) => void;
  onClear?: () => void;
  main?: boolean;
  browseRef?: MutableRefObject<(() => void) | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const enterCount = useRef(0);
  if (browseRef) browseRef.current = () => inputRef.current?.click();

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
    <div className="dz-wrap">
      <div
        className={`dz${main ? ' dz-main' : ''}${preview ? ' has' : ''}${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={preview ? `Replace ${label}` : `Add ${label}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragEnter={handleDragEnter}
        onDragOver={e => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="" />
        ) : (
          <>
            <span className="dz-plus">+</span>
            <span className="dz-label">{dragging ? 'Drop' : label}</span>
          </>
        )}
        {preview && !dragging && (
          <div className="dz-hover">
            <span>📁 {main ? 'Click to replace' : 'Replace'}</span>
            {main && <small>or drop a photo here</small>}
          </div>
        )}
        {dragging && preview && (
          <div className="dz-drop">{main ? '⬇ Drop to replace the main photo' : '⬇ Drop'}</div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {!main && preview && onClear && (
        <button type="button" className="dz-remove" onClick={e => { e.stopPropagation(); onClear(); }}>✕ remove</button>
      )}
    </div>
  );
}
