'use client';
import { useEffect, useRef, useState } from 'react';
import DietChips from '@/components/DietChips';
import type { useNewProduct } from '@/components/NewProductDraft';

// Shop edit mode: the yellow "+ New product" card at the top-left. Same draft,
// barcode lookup and saving as the yellow new row on the admin Products page.

const CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

type Api = ReturnType<typeof useNewProduct>;

export default function ShopNewProductCard({ api, notice }: { api: Api; notice: string }) {
  const d = api.draft;
  const [code, setCode] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Always have a blank draft ready while this card is showing.
  useEffect(() => { if (!api.draft) { api.startEmpty(); setCode(''); } }, [api.draft]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return <div className="card card-new" />;

  const bad = (f: string) => d.missing.includes(f) ? ' ce-bad' : '';
  const main = d.slots[0].src;
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); api.save(); } };

  function lookUp() {
    const text = code.trim();
    if (/^\d{6,14}$/.test(text)) api.startFromBarcode(text);
  }

  function takeFile(f: File | undefined) {
    if (f?.type.startsWith('image/')) api.setFile(0, f);
  }

  return (
    <div className="card card-new">
      <div className="cn-barcode">
        <span aria-hidden="true">▦</span>
        <input value={code} inputMode="numeric" placeholder="Scan or type a barcode" aria-label="Barcode"
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookUp(); } }} />
      </div>
      {notice && <div className="cn-status cn-dup">{notice}</div>}
      {!notice && d.lookingUp && <div className="cn-status">Looking up {d.barcode}…</div>}
      {!notice && d.found === 'found' && <div className="cn-status cn-ok">✓ Found online · {d.barcode}</div>}
      {!notice && d.found === 'notfound' && <div className="cn-status cn-no">Not found online · type the details</div>}

      <div
        className={`cn-photo${main ? ' has' : ''}${dragging ? ' dragging' : ''}${bad('photo')}`}
        role="button" tabIndex={0} aria-label={main ? 'Replace photo' : 'Add photo'}
        onClick={() => fileRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
        onDragEnter={e => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
        onDrop={e => { e.preventDefault(); dragDepth.current = 0; setDragging(false); takeFile(e.dataTransfer.files[0]); }}
      >
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main} alt="" />
        ) : (
          <span className="cn-empty"><b>+</b>New product<small>drop a photo, or click to browse</small></span>
        )}
        {dragging && <div className="ce-drop">⬇ Drop photo</div>}
        {main && (
          <button type="button" className="ce-rotate" title="Rotate" aria-label="Rotate photo" disabled={api.rotating}
            onClick={e => { e.stopPropagation(); api.rotateMain(); }}>↺</button>
        )}
        {d.reading && <div className="ce-hint">Reading the photo…</div>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onClick={e => e.stopPropagation()}
          onChange={e => { takeFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      {d.webImgs.length > 0 && (
        <div className="cn-web" aria-label="Photos found online">
          {d.webImgs.slice(0, 6).map(u => (
            <button key={u} type="button" className={d.slots.some(s => s.src === u && !s.file) ? 'on' : ''} onClick={() => api.toggleWeb(u)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" />
            </button>
          ))}
        </div>
      )}

      <div className="card-body cn-body">
        <select className="ce-cat" value={d.category} aria-label="Category" onChange={e => api.patch({ category: e.target.value })}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={`cn-in cn-name${bad('name')}`} placeholder="Type the name" value={d.name}
          onChange={e => api.patch({ name: e.target.value, missing: d.missing.filter(m => m !== 'name') })} onKeyDown={onKey} />
        <input className={`cn-in cn-size${bad('size')}`} placeholder="Size, e.g. 500g" value={d.size}
          onChange={e => api.patch({ size: e.target.value, missing: d.missing.filter(m => m !== 'size') })} onKeyDown={onKey} />
        <div className="cn-prices">
          <input className="cn-in cn-deal" type="number" min="0" step="0.01" placeholder="Deal" aria-label="Deal (normal price)"
            value={d.marketPrice} onChange={e => api.patch({ marketPrice: e.target.value })} onKeyDown={onKey} />
          <input className={`cn-in cn-price${bad('price')}`} type="number" min="0" step="0.01" placeholder="Price" aria-label="Price"
            value={d.price} onChange={e => api.patch({ price: e.target.value, missing: d.missing.filter(m => m !== 'price') })} onKeyDown={onKey} />
        </div>
        <label className="cn-bb">Best Before
          <input className="cn-in" type="date" value={d.bestBefore} onChange={e => api.patch({ bestBefore: e.target.value })} onKeyDown={onKey} />
        </label>
        <DietChips value={{ halal: d.halal, kosher: d.kosher, vegan: d.vegan }} onToggle={k => api.patch({ [k]: !d[k] })} />
        {d.error && <p className="cn-error">{d.error}</p>}
      </div>

      <div className="card-admin">
        <span className="ce-qty">Qty
          <input className="cn-in cn-qty" type="number" min="0" step="1" placeholder="—" value={d.quantity}
            onChange={e => api.patch({ quantity: e.target.value })} onKeyDown={onKey} />
        </span>
        <div className="stock-switch-wrap compact">
          <button type="button" role="switch" aria-checked={false} aria-label="Add to the shop" title="Add to the shop"
            className="stock-switch new" onClick={() => api.save()} disabled={d.saving} />
          <span className="stock-label stock-new">{d.saving ? '…' : 'Add'}</span>
        </div>
        <button type="button" className="ce-del" title="Clear this new product" aria-label="Clear this new product"
          onClick={() => { api.cancel(); setCode(''); }}>✕</button>
      </div>
    </div>
  );
}
