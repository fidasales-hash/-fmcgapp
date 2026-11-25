'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product } from '@/lib/types';
import StockSwitch from '@/components/StockSwitch';
import EditableCell from '@/components/EditableCell';
import DietChips from '@/components/DietChips';
import { useNewProduct } from '@/components/NewProductDraft';
import ShopNewProductCard from '@/components/ShopNewProductCard';
import { saveProductFields, saveProductPhoto, clearProductPhoto, rotatedPhoto, saveProductQuantity, saveProductStock, removeProduct } from '@/lib/productEdits';

const WHATSAPP_NUMBER = '27615807797';

const STORE_INFO = {
  name:    'Clearance Shop',
  address: 'Park Crescent, Glenhazel, Johannesburg, Gauteng',
  hours:   'Mon–Friday 9am–4pm',
  payment: 'Credit & Debit Cards',
  phone:   '+27 61 580 7797',
  returns: 'Hassle-free returns, always. If it\'s damaged or unfit to eat, we collect for free.',
};

function StoreInfoDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="cart-backdrop" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-drawer-header">
          <h2>Store Info</h2>
          <button className="cart-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="store-info-body">
          <div className="store-info-row">
            <span className="store-info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <p className="store-info-label">Collection Point</p>
              <p className="store-info-value">{STORE_INFO.address}</p>
              <p className="store-info-value" style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>WhatsApp to arrange collection</p>
            </div>
          </div>
          <div className="store-info-row">
            <span className="store-info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <div>
              <p className="store-info-label">Hours</p>
              <p className="store-info-value">{STORE_INFO.hours}</p>
            </div>
          </div>
          <div className="store-info-row">
            <span className="store-info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>
            <div>
              <p className="store-info-label">Payment Methods</p>
              <p className="store-info-value">{STORE_INFO.payment}</p>
            </div>
          </div>
          <div className="store-info-row">
            <span className="store-info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.42 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
            </span>
            <div>
              <p className="store-info-label">Phone</p>
              <a href={`tel:${STORE_INFO.phone.replace(/\s/g, '')}`} className="store-info-value" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{STORE_INFO.phone}</a>
            </div>
          </div>
          <div className="store-info-row">
            <span className="store-info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </span>
            <div>
              <p className="store-info-label">Delivery</p>
              <p className="store-info-value">We courier nationwide across South Africa. Standard courier fee R50 on all orders.</p>
            </div>
          </div>
          <div className="store-info-row">
            <span className="store-info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
            </span>
            <div>
              <p className="store-info-label">Returns</p>
              <p className="store-info-value">{STORE_INFO.returns}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="btn-whatsapp"
            style={{ marginTop: '1rem' }}
          >
            Chat with us on WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}

type CartItem = { product: Product; qty: number };

function isExpired(bestBefore: string) {
  if (!bestBefore) return false;
  const d = new Date(bestBefore + 'T00:00:00');
  if (isNaN(d.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function formatBB(bestBefore: string) {
  const d = new Date(bestBefore + 'T00:00:00');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
}


const EDIT_CATEGORIES = ['Drinks', 'Tinned & Canned', 'Snacks & Confectionery', 'Bakery & Cereals', 'Home & Cleaning', 'Health & Beauty', 'Baby & Toddler', 'Pet', 'Electronics', 'Other'];

// Shop edit mode (admin only): every card edits in place and saves as you go.
type CardEdit = {
  save: (changes: Partial<Product>) => Promise<boolean>;
  photo: (slot: 1 | 2 | 3, file: File) => Promise<void>;
  clearPhoto: (slot: 2 | 3) => Promise<void>;
  rotate: (slot: 1 | 2 | 3) => Promise<void>;
  qty: (v: string) => Promise<boolean>;
  stock: () => void;
  remove: () => void;
  busy: string; // '' or what's being saved, shown over the photo
};

function ProductCard({ product, onExpand, onAddToCart, cartQty, onUpdateQty, edit, flash }: {
  product: Product;
  onExpand: (urls: string[], index: number) => void;
  onAddToCart: (product: Product) => void;
  cartQty: number;
  onUpdateQty: (id: string, qty: number) => void;
  edit?: CardEdit;
  flash?: boolean;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [askRemove, setAskRemove] = useState(false);

  const expired = isExpired(product.bestBefore);
  const soldOut = product.inStock === false;
  const photos = [product.photoUrl, product.photoUrl2, product.photoUrl3].filter(Boolean) as string[];

  // Edit mode works on the three real photo slots, plus one empty "+ Photo N" slot.
  const slotUrls = [product.photoUrl, product.photoUrl2, product.photoUrl3];
  const lastFilled = slotUrls.reduce((n, u, i) => (u ? i : n), 0);
  const count = edit ? Math.min(3, lastFilled + 2) : photos.length;
  const idx = Math.min(photoIndex, Math.max(count - 1, 0));
  const shownUrl = edit ? (slotUrls[idx] ?? '') : (photos[idx] ?? product.photoUrl);
  const slot = (idx + 1) as 1 | 2 | 3;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (count < 2 || touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 40) {
      didSwipe.current = true;
      setPhotoIndex(i => deltaX < 0 ? Math.min(i + 1, count - 1) : Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  }

  function handlePhotoClick() {
    if (didSwipe.current) { didSwipe.current = false; return; }
    if (edit) { if (!edit.busy) fileRef.current?.click(); return; }
    onExpand(photos, idx);
  }

  const dropProps = edit ? {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); dragDepth.current++; setDragging(true); },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragLeave: () => { dragDepth.current--; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); dragDepth.current = 0; setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/') && !edit.busy) edit.photo(slot, f);
    },
  } : {};

  const hasDeal = product.marketPrice > product.price;

  return (
    <div id={`p-${product.id}`} className={`card ${expired ? 'expired' : 'fresh'}${soldOut ? ' sold-out' : ''}${edit ? ' card-editing' : ''}${flash ? ' card-flash' : ''}`}>
      <div
        className={`photo-wrap${dragging ? ' dragging' : ''}`}
        style={{ cursor: 'pointer' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handlePhotoClick}
        {...dropProps}
      >
        {shownUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shownUrl} alt={product.name} loading="lazy" />
        ) : (
          <div className="photo-empty">+ Photo {slot}</div>
        )}
        {soldOut && <div className="sold-out-ribbon">SOLD OUT</div>}
        <span className={`badge ${expired ? 'badge-expired' : 'badge-fresh'}`}>
          {expired ? 'Past Best Before' : 'In Date'}
        </span>
        {count > 1 && (
          <>
            {idx > 0 && (
              <button className="photo-arrow" style={{ left: '0.4rem' }}
                onClick={e => { e.stopPropagation(); setPhotoIndex(idx - 1); }}
                aria-label="Previous photo">‹</button>
            )}
            {idx < count - 1 && (
              <button className="photo-arrow" style={{ right: '0.4rem' }}
                onClick={e => { e.stopPropagation(); setPhotoIndex(idx + 1); }}
                aria-label="Next photo">›</button>
            )}
            {!edit && (
              <div style={{ position: 'absolute', bottom: '0.4rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.3rem', pointerEvents: 'none' }}>
                {photos.map((_, i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)' }} />
                ))}
              </div>
            )}
          </>
        )}
        {edit && (
          <>
            {shownUrl && (
              <button type="button" className="ce-rotate" title="Rotate" aria-label="Rotate photo"
                onClick={e => { e.stopPropagation(); if (!edit.busy) edit.rotate(slot); }}>↺</button>
            )}
            {idx > 0 && shownUrl && <span className="ce-which">Photo {slot} of {count}</span>}
            {idx > 0 && shownUrl && (
              <button type="button" className="ce-photo-x"
                onClick={e => { e.stopPropagation(); if (!edit.busy && confirm(`Remove photo ${slot}?`)) edit.clearPhoto(slot as 2 | 3); }}>✕ remove</button>
            )}
            {edit.busy
              ? <div className="ce-busy">{edit.busy}</div>
              : dragging
                ? <div className="ce-drop">⬇ Drop to replace</div>
                : <div className="ce-hint">Drop a photo, or click to browse</div>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onClick={e => e.stopPropagation()}
              onChange={e => { const f = e.target.files?.[0]; if (f) edit.photo(slot, f); e.target.value = ''; }} />
          </>
        )}
      </div>
      {edit ? (
        <div className="card-body ce-body">
          <select className="ce-cat" value={product.category} aria-label="Category"
            onChange={e => edit.save({ category: e.target.value })}>
            {(EDIT_CATEGORIES.includes(product.category) ? EDIT_CATEGORIES : [product.category, ...EDIT_CATEGORIES]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="ce-name">
            <EditableCell value={product.name} display={product.name}
              onSave={v => v ? edit.save({ name: v }) : Promise.resolve(false)} />
          </div>
          <div className="ce-size">
            <EditableCell value={product.size ?? ''} display={product.size || '+ Size'} onSave={v => edit.save({ size: v })} />
          </div>
          <div className="ce-price">
            <span className="ce-deal">
              <EditableCell type="number" value={product.marketPrice ? String(Number(product.marketPrice)) : ''}
                display={product.marketPrice ? `R ${Number(product.marketPrice).toFixed(2)}` : '+ Deal'}
                onSave={v => edit.save({ marketPrice: parseFloat(v) || 0 })} />
            </span>
            <span className="ce-now">
              <EditableCell type="number" value={String(Number(product.price ?? 0))} display={`R ${Number(product.price ?? 0).toFixed(2)}`}
                onSave={v => edit.save({ price: parseFloat(v) || 0 })} />
            </span>
            {hasDeal && <span className="savings-badge">{Math.round((1 - product.price / product.marketPrice) * 100)}% off</span>}
          </div>
          <div className="ce-bb">
            <span>Best Before:</span>
            <EditableCell type="date" value={product.bestBefore ?? ''} display={formatBB(product.bestBefore)}
              onSave={v => edit.save({ bestBefore: v })} />
          </div>
          <DietChips value={{ halal: !!product.halal, kosher: !!product.kosher, vegan: !!product.vegan }}
            onToggle={d => edit.save({ [d]: !product[d] })} />
        </div>
      ) : (
        <div className="card-body">
          <span className="cat-label">{product.category}</span>
          <h2>{product.name}</h2>
          {product.size && <p className="size">{product.size}</p>}
          {product.sellerName && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0 0 0.3rem' }}>Sold by {product.sellerName}</p>}
          {(product.halal || product.kosher || product.vegan) && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
              {product.halal  && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 10, background: '#dcfce7', color: '#15803d' }}>☪ Halal</span>}
              {product.kosher && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>✡ Kosher</span>}
              {product.vegan  && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 10, background: '#dcfce7', color: '#15803d' }}>🌱 Vegan</span>}
            </div>
          )}
          {product.price > 0 && (
            <div className="price-wrap">
              {hasDeal && (
                <span className="market-price">R {Number(product.marketPrice).toFixed(2)}</span>
              )}
              <p className="price">R {Number(product.price).toFixed(2)}</p>
              {hasDeal && (
                <span className="savings-badge">{Math.round((1 - product.price / product.marketPrice) * 100)}% off</span>
              )}
            </div>
          )}
          <p className="best-before">Best Before: {formatBB(product.bestBefore)}</p>
          {product.notes && <p className="notes">{product.notes}</p>}
          {soldOut ? (
            <button className="btn-add-cart btn-sold-out" disabled>Sold out</button>
          ) : cartQty === 0 ? (
            <button className="btn-add-cart" onClick={() => onAddToCart(product)}>+ Add to Order</button>
          ) : (
            <div className="card-stepper">
              <button onClick={() => onUpdateQty(product.id, cartQty - 1)}>−</button>
              <span>{cartQty}</span>
              <button onClick={() => onUpdateQty(product.id, cartQty + 1)}>+</button>
            </div>
          )}
        </div>
      )}
      {edit && (
        <div className="card-admin">
          {askRemove ? (
            <span className="ce-ask">Remove?
              <button type="button" className="ce-yes" onClick={() => { setAskRemove(false); edit.remove(); }}>Yes</button>
              <button type="button" className="ce-no" onClick={() => setAskRemove(false)}>No</button>
            </span>
          ) : (
            <>
              <span className="ce-qty">Qty
                <EditableCell type="number" value={product.quantity != null ? String(product.quantity) : ''}
                  display={product.quantity != null ? String(product.quantity) : '—'} onSave={edit.qty} />
              </span>
              <StockSwitch compact inStock={!soldOut} onToggle={edit.stock} />
              <button type="button" className="ce-del" title="Remove product" aria-label="Remove product" onClick={() => setAskRemove(true)}>🗑</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type CustomerDetails = {
  name: string;
  phone: string;
  fulfillment: 'collection' | 'delivery';
  address: string;
  notes: string;
};

function CartDrawer({ cart, onClose, onUpdateQty, onRemove, onClear }: {
  cart: CartItem[];
  onClose: () => void;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [details, setDetails] = useState<CustomerDetails>({
    name: '', phone: '', fulfillment: 'collection', address: '', notes: '',
  });
  const detailsLoaded = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cs_details');
      if (saved) setDetails(JSON.parse(saved));
    } catch {}
    detailsLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!detailsLoaded.current) return;
    localStorage.setItem('cs_details', JSON.stringify(details));
  }, [details]);

  const total = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  const canSubmit = details.name.trim() && details.phone.trim() &&
    (details.fulfillment === 'collection' || details.address.trim());

  const message = [
    '*New Order — Clearance Shop*',
    '',
    `Name: ${details.name}`,
    `Phone: ${details.phone}`,
    details.fulfillment === 'delivery'
      ? `Delivery: ${details.address}${details.notes ? `\nNotes: ${details.notes}` : ''}`
      : 'Collection',
    '',
    ...cart.map((i, idx) => [
      `*${idx + 1}. ${i.product.name}${i.product.size ? ` (${i.product.size})` : ''}*`,
      `${i.qty} x R${i.product.price.toFixed(2)} = R${(i.product.price * i.qty).toFixed(2)}`,
    ].join('\n')),
    '',
    `*TOTAL: R${total.toFixed(2)}*`,
  ].join('\n');

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  const set = (field: keyof CustomerDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDetails(d => ({ ...d, [field]: e.target.value }));

  if (step === 'details') {
    return (
      <>
        <div className="cart-backdrop" onClick={onClose} />
        <div className="cart-drawer">
          <div className="cart-drawer-header">
            <button className="cart-close" onClick={() => setStep('cart')} aria-label="Back" style={{ fontSize: '0.9rem' }}>← Back</button>
            <h2>Your Details</h2>
            <button className="cart-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="checkout-form">
            <input className="field" placeholder="Full name *" value={details.name} onChange={set('name')} />
            <input className="field" placeholder="Phone number *" type="tel" value={details.phone} onChange={set('phone')} />

            <div className="fulfillment-toggle">
              {(['collection', 'delivery'] as const).map(f => (
                <button
                  key={f}
                  className={`fulfillment-btn${details.fulfillment === f ? ' active' : ''}`}
                  onClick={() => setDetails(d => ({ ...d, fulfillment: f }))}
                >
                  {f === 'collection' ? 'Collection' : 'Delivery'}
                </button>
              ))}
            </div>

            {details.fulfillment === 'delivery' && (
              <>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Standard courier fee: <strong style={{ color: 'var(--text)' }}>R50</strong></p>
                <input className="field" placeholder="Street address *" value={details.address} onChange={set('address')} />
                <input className="field" placeholder="Notes — suburb, gate code, landmark" value={details.notes} onChange={set('notes')} />
              </>
            )}
          </div>

          <div className="cart-footer">
            <p className="cart-total">Total: <strong>R {total.toFixed(2)}</strong></p>
            <a
              href={canSubmit ? waUrl : undefined}
              target="_blank"
              rel="noreferrer"
              className="btn-whatsapp"
              style={{ opacity: canSubmit ? 1 : 0.45, pointerEvents: canSubmit ? 'auto' : 'none' }}
              onClick={() => { if (canSubmit) { onClear(); onClose(); } }}
            >
              Send Order via WhatsApp
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cart-backdrop" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-drawer-header">
          <h2>Your Order</h2>
          <button className="cart-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {cart.length === 0 ? (
          <p className="cart-empty">No items added yet.</p>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(({ product, qty }) => (
                <div key={product.id} className="cart-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.photoUrl} alt={product.name} className="cart-item-img" />
                  <div className="cart-item-info">
                    <p className="cart-item-name">{product.name}</p>
                    {product.size && <p className="cart-item-size">{product.size}</p>}
                    <p className="cart-item-price">R {(product.price * qty).toFixed(2)}</p>
                  </div>
                  <div className="cart-item-qty">
                    <button onClick={() => onUpdateQty(product.id, qty - 1)}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => onUpdateQty(product.id, qty + 1)}>+</button>
                  </div>
                  <button className="cart-item-remove" onClick={() => onRemove(product.id)} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <p className="cart-total">Total: <strong>R {total.toFixed(2)}</strong></p>
              <button className="btn-whatsapp" onClick={() => setStep('details')}>
                Checkout
              </button>
              <button className="btn-clear-cart" onClick={onClear}>Clear order</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}


export default function StorefrontClient({ initialProducts, initialCategory = 'All' }: { initialProducts: Product[]; initialCategory?: string }) {
  // "← Back to admin" shows only when the shop was opened from the admin's
  // "View store" link (?from=/admin/...). Remembered for this tab only.
  const [adminBack, setAdminBack] = useState('');
  const [editMode, setEditMode] = useState(false);
  const frozenOrder = useRef<{ sort: string; order: Map<string, number> } | null>(null);

  // "+ New product" card (edit mode). A new product goes in right after it;
  // a barcode that's already in the shop flashes that product's card.
  const [newNotice, setNewNotice] = useState('');
  const [flashId, setFlashId] = useState('');
  const np = useNewProduct(
    added => {
      setProducts(prev => [added, ...prev.filter(p => p.id !== added.id)]);
      frozenOrder.current?.order.set(added.id, -1);
    },
    (id, name) => {
      setNewNotice(`Already in your shop: ${name}`);
      setTimeout(() => setNewNotice(''), 4000);
      setFlashId(id);
      setTimeout(() => setFlashId(''), 2500);
      setTimeout(() => document.getElementById(`p-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    },
  );
  // Leaving edit mode throws away an unsaved new product (and its Ctrl+V paste handler).
  useEffect(() => { if (!(adminBack && editMode) && np.draft) np.cancel(); }, [adminBack, editMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState<Record<string, string>>({});

  function toggleEditMode() {
    setEditMode(on => {
      try { sessionStorage.setItem('shopEdit', on ? '' : '1'); } catch {}
      return !on;
    });
  }

  // Edit mode saves. Everything goes through the same admin routes as the
  // Products page and needs the admin sign-in, so customers can't save.
  const SIGN_IN = 'Open the admin, sign in, then try again.';
  function replaceProduct(next: Product) {
    setProducts(prev => prev.map(p => p.id === next.id ? next : p));
  }
  async function editSave(p: Product, changes: Partial<Product>): Promise<boolean> {
    const next = { ...p, ...changes };
    replaceProduct(next);
    try { await saveProductFields(next); return true; }
    catch (e) { replaceProduct(p); alert(`Couldn't save. ${e instanceof Error && e.message !== 'Save failed' ? e.message : SIGN_IN}`); return false; }
  }
  async function withPhotoBusy(p: Product, label: string, run: () => Promise<{ photoUrl?: string; photoUrl2?: string; photoUrl3?: string }>) {
    setBusy(b => ({ ...b, [p.id]: label }));
    try {
      const urls = await run();
      setProducts(prev => prev.map(x => x.id === p.id ? {
        ...x,
        photoUrl: urls.photoUrl ?? x.photoUrl,
        photoUrl2: urls.photoUrl2 ?? x.photoUrl2,
        photoUrl3: urls.photoUrl3 ?? x.photoUrl3,
      } : x));
    } catch (e) {
      alert(`Couldn't save the photo. ${e instanceof Error && e.message !== 'Save failed' && e.message !== 'load' && e.message !== 'rotate' ? e.message : SIGN_IN}`);
    } finally {
      setBusy(b => { const n = { ...b }; delete n[p.id]; return n; });
    }
  }
  function editApi(p: Product) {
    return {
      busy: busy[p.id] ?? '',
      save: (changes: Partial<Product>) => editSave(p, changes),
      photo: (slot: 1 | 2 | 3, file: File) => withPhotoBusy(p, 'Saving photo…', () => saveProductPhoto(p, slot, file)),
      clearPhoto: (slot: 2 | 3) => withPhotoBusy(p, 'Removing…', () => clearProductPhoto(p, slot)),
      rotate: (slot: 1 | 2 | 3) => withPhotoBusy(p, 'Rotating…', async () => {
        const url = [p.photoUrl, p.photoUrl2, p.photoUrl3][slot - 1];
        return saveProductPhoto(p, slot, await rotatedPhoto(url));
      }),
      qty: async (v: string) => {
        const n = v === '' ? null : parseInt(v, 10);
        if (n !== null && (isNaN(n) || n < 0)) return false;
        replaceProduct({ ...p, quantity: n });
        try { await saveProductQuantity(p.id, n); return true; }
        catch { replaceProduct(p); alert(`Couldn't save. ${SIGN_IN}`); return false; }
      },
      stock: async () => {
        const inStock = p.inStock === false;
        replaceProduct({ ...p, inStock });
        try { await saveProductStock(p.id, inStock); }
        catch { replaceProduct(p); alert(`Couldn't save. ${SIGN_IN}`); }
      },
      remove: async () => {
        setBusy(b => ({ ...b, [p.id]: 'Removing…' }));
        try { await removeProduct(p.id); setProducts(prev => prev.filter(x => x.id !== p.id)); }
        catch { alert(`Couldn't remove it. ${SIGN_IN}`); }
        finally { setBusy(b => { const n = { ...b }; delete n[p.id]; return n; }); }
      },
    };
  }
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from') ?? '';
      if (from.startsWith('/admin')) {
        sessionStorage.setItem('adminBack', from);
        url.searchParams.delete('from');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      const saved = sessionStorage.getItem('adminBack') ?? '';
      if (saved.startsWith('/admin')) {
        setAdminBack(saved);
        if (sessionStorage.getItem('shopEdit') === '1') setEditMode(true);
      }
    } catch { /* storage blocked: no button */ }
  }, []);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(initialCategory);

  function selectCategory(cat: string) {
    setCategory(cat);
    const url = cat === 'All' ? '/' : `/?category=${encodeURIComponent(cat)}`;
    window.history.replaceState(null, '', url);
  }
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('newest');
  const [lightboxImgs, setLightboxImgs] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const cartLoaded = useRef(false);
  const lbTouchX = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cs_cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    cartLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!cartLoaded.current) return;
    localStorage.setItem('cs_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!lightboxImgs.length) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImgs([]);
      if (e.key === 'ArrowLeft') setLightboxIdx(i => Math.max(i - 1, 0));
      if (e.key === 'ArrowRight') setLightboxIdx(i => Math.min(i + 1, lightboxImgs.length - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxImgs]);


  // While editing, don't reload on window focus: closing the file picker
  // focuses the window and would overwrite a save that's still going.
  const editingRef = useRef(false);
  editingRef.current = !!adminBack && editMode;

  const fetchProducts = useCallback(async () => {
    if (editingRef.current) return;
    const res = await fetch('/api/products');
    setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    window.addEventListener('focus', fetchProducts);
    return () => window.removeEventListener('focus', fetchProducts);
  }, [fetchProducts]);

  // Drop anything from a saved cart that has since been marked sold out.
  useEffect(() => {
    if (!products.length) return;
    const soldOut = new Set(products.filter(p => p.inStock === false).map(p => p.id));
    if (!soldOut.size) return;
    setCart(prev => prev.some(i => soldOut.has(i.product.id)) ? prev.filter(i => !soldOut.has(i.product.id)) : prev);
  }, [products]);

  function addToCart(product: Product) {
    if (product.inStock === false) return;
    const isFirstAdd = !cart.find(i => i.product.id === product.id);
    if (isFirstAdd) {
      fetch('/api/popular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id }),
      }).catch(() => {});
    }
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) return setCart(prev => prev.filter(i => i.product.id !== id));
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, qty } : i));
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i.product.id !== id));
  }

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category))).sort()];

  const sortFn = (a: Product, b: Product) => {
    // Sold-out items always sit at the end, whatever the chosen sort.
    const aOut = a.inStock === false ? 1 : 0;
    const bOut = b.inStock === false ? 1 : 0;
    if (aOut !== bOut) return aOut - bOut;
    if (sort === 'popular') return b.orderCount - a.orderCount;
    if (sort === 'price-asc' || sort === 'under-100') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  };

  // Edit mode freezes the order so a card stays put while you change it
  // (e.g. flipping Off doesn't send it to the bottom). Re-sorts when Edit is
  // turned off, or when you pick a different sort.
  const editing = !!adminBack && editMode;
  if (!editing) frozenOrder.current = null;
  else if (!frozenOrder.current || frozenOrder.current.sort !== sort) {
    frozenOrder.current = { sort, order: new Map([...products].sort(sortFn).map((p, i) => [p.id, i])) };
  }
  const order = frozenOrder.current?.order;

  const filtered = products
    .filter(p => {
      const expired = isExpired(p.bestBefore);
      return (
        (category === 'All' || p.category === category) &&
        (status === 'All' || (status === 'In Date' && !expired) || (status === 'Past Best Before' && expired)) &&
        (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
        (sort !== 'under-100' || p.price < 100)
      );
    })
    .sort(order
      ? (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)
      : sortFn);

  return (
    <>
      {lightboxImgs.length > 0 && (
        <div className="lightbox-backdrop"
          onTouchStart={e => { lbTouchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const dx = lbTouchX.current === null ? 0 : e.changedTouches[0].clientX - lbTouchX.current;
            lbTouchX.current = null;
            if (Math.abs(dx) < 40) { setLightboxImgs([]); return; }
            if (dx < 0) setLightboxIdx(i => Math.min(i + 1, lightboxImgs.length - 1));
            else setLightboxIdx(i => Math.max(i - 1, 0));
          }}
          onClick={() => setLightboxImgs([])}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxImgs[lightboxIdx]} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
          <button className="lightbox-close" onClick={() => setLightboxImgs([])} aria-label="Close">✕</button>
          {lightboxIdx > 0 && (
            <button className="lightbox-arrow lightbox-arrow-left"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.max(i - 1, 0)); }}
              onTouchEnd={e => { e.stopPropagation(); setLightboxIdx(i => Math.max(i - 1, 0)); }}
              aria-label="Previous">‹</button>
          )}
          {lightboxIdx < lightboxImgs.length - 1 && (
            <button className="lightbox-arrow lightbox-arrow-right"
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => Math.min(i + 1, lightboxImgs.length - 1)); }}
              onTouchEnd={e => { e.stopPropagation(); setLightboxIdx(i => Math.min(i + 1, lightboxImgs.length - 1)); }}
              aria-label="Next">›</button>
          )}
        </div>
      )}

      {infoOpen && <StoreInfoDrawer onClose={() => setInfoOpen(false)} />}

      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onClear={() => setCart([])}
        />
      )}

      <div className="page-wrap">
        <div className="top-bar">
        <header className="site-header">
          <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Open order">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          {adminBack && (
            <div className="admin-tools">
              <a href={adminBack} className="back-to-admin">← <span>Back to </span>admin</a>
              <button type="button" role="switch" aria-checked={editMode} className="edit-mode-btn" onClick={toggleEditMode}>
                <span className={`stock-switch${editMode ? '' : ' off'}`} aria-hidden="true" />✎ Edit
              </button>
            </div>
          )}
          <div className="site-wordmark">
            <span className="site-wordmark-text">
              <span className="site-wordmark-super">CLEARANCE</span>
              <span className="site-wordmark-main">SHOP</span>
            </span>
          </div>
          <div className="header-search">
            <input
              ref={searchRef}
              className={`header-search-input${searchOpen ? ' open' : ''}`}
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className="cart-btn" onClick={() => { setSearchOpen(o => !o); if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 50); if (searchOpen) setSearch(''); }} aria-label="Search">
              {searchOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              }
            </button>
          </div>
        </header>
        {adminBack && editMode && (
          <div className="edit-tip">Edit mode: click any text to change it (Enter saves) · drop a photo on a picture to replace it · flip Edit off when you&apos;re done</div>
        )}

        <div className="mobile-filters">
          <select className="mobile-select" value={category} onChange={e => selectCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <select className="mobile-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="All">All Dates</option>
            <option value="In Date">In Date</option>
            <option value="Past Best Before">Past BB</option>
          </select>
          <select className="mobile-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
            <option value="price-asc">Low→High</option>
            <option value="price-desc">High→Low</option>
            <option value="under-100">Under R100</option>
          </select>
        </div>

        </div>{/* end .top-bar */}

        <div className="body-layout">
          <aside className="sidebar">
            <div className="sidebar-section">
              <p className="sidebar-label">Category</p>
              {categories.map(c => (
                <button key={c} className={`sidebar-chip${category === c ? ' active' : ''}`} onClick={() => selectCategory(c)}>
                  {c === 'All' ? 'All' : c}
                </button>
              ))}
            </div>
            <div className="sidebar-section">
              <p className="sidebar-label">Status</p>
              {(['All', 'In Date', 'Past Best Before'] as const).map(s => (
                <button
                  key={s}
                  className={`sidebar-chip${status === s ? ' active' + (s === 'In Date' ? ' green' : s === 'Past Best Before' ? ' red' : '') : ''}`}
                  onClick={() => setStatus(s)}
                >
                  {s === 'All' ? 'All Dates' : s}
                </button>
              ))}
            </div>
            <div className="sidebar-section">
              <p className="sidebar-label">Sort</p>
              {([['newest', 'Newest'], ['popular', 'Popular'], ['price-asc', 'Price: Low→High'], ['price-desc', 'Price: High→Low'], ['under-100', 'Under R100']] as const).map(([val, label]) => (
                <button key={val} className={`sidebar-chip${sort === val ? ' active' : ''}`} onClick={() => setSort(val)}>
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <main className="main-content">
            {loading && <p className="loading">Loading products…</p>}
            {!loading && filtered.length === 0 && (
              <p className="empty">{products.length === 0 ? 'No products yet.' : 'No products match the filters.'}</p>
            )}
            <div className="grid">
              {adminBack && editMode && <ShopNewProductCard api={np} notice={newNotice} />}
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onExpand={(urls, idx) => { setLightboxImgs(urls); setLightboxIdx(idx); }}
                  onAddToCart={addToCart}
                  cartQty={cart.find(i => i.product.id === product.id)?.qty ?? 0}
                  onUpdateQty={updateQty}
                  edit={adminBack && editMode ? editApi(product) : undefined}
                  flash={flashId === product.id}
                />
              ))}
            </div>
          </main>
        </div>

        <button className="info-footer" onClick={() => setInfoOpen(o => !o)} aria-label="Store info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Hours · Location · Returns</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </>
  );
}
