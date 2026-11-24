'use client';
import { useState, useRef } from 'react';

// A table cell that turns into an input when clicked. Enter or clicking away
// saves; Esc cancels. onSave resolves false when the save failed.
export default function EditableCell({ value, display, type = 'text', align, onSave }: {
  value: string; display: string; type?: 'text' | 'number' | 'date'; align?: 'right';
  onSave: (v: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [flash, setFlash] = useState<'' | 'ok' | 'err'>('');
  const doneRef = useRef(false);

  function open() { setDraft(value); doneRef.current = false; setEditing(true); }
  async function finish(save: boolean) {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    if (!save || draft.trim() === value) return;
    const ok = await onSave(draft.trim());
    setFlash(ok ? 'ok' : 'err');
    setTimeout(() => setFlash(''), 1200);
  }

  if (editing) {
    return (
      <input
        autoFocus
        className={`inl-input${align === 'right' ? ' num' : ''}`}
        type={type} step={type === 'number' ? '0.01' : undefined} min={type === 'number' ? '0' : undefined}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={e => { if (type !== 'date') e.currentTarget.select(); }}
        onKeyDown={e => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); }}
        onBlur={() => finish(true)}
      />
    );
  }
  return (
    <button type="button" className={`inl-cell${align === 'right' ? ' num' : ''}${flash ? ` inl-${flash}` : ''}`} onClick={open} title={display}>
      {display}
    </button>
  );
}
