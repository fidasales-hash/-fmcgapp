'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product } from '@/lib/types';

const WHATSAPP_NUMBER = '27615807797';

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

function ProductCard({ product, onExpand, onAddToCart, cartQty, onUpdateQty }: {
  product: Product;
  onExpand: (url: string) => void;
  onAddToCart: (product: Product) => void;
  cartQty: number;
  onUpdateQty: (id: string, qty: number) => void;
}) {
  const [showSecond, setShowSecond] = useState(false);
  const expired = isExpired(product.bestBefore);
  const hasTwo = Boolean(product.photoUrl2);
  const activeUrl = showSecond && product.photoUrl2 ? product.photoUrl2 : product.photoUrl;

  return (
    <div className={`card ${expired ? 'expired' : 'fresh'}`}>
      <div className="photo-wrap" style={{ cursor: 'pointer' }} onClick={() => onExpand(activeUrl)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={activeUrl} alt={product.name} loading="lazy" />
        <span className={`badge ${expired ? 'badge-expired' : 'badge-fresh'}`}>
          {expired ? 'Past Best Before' : 'In Date'}
        </span>
        {hasTwo && (
          <div className="photo-dots" onClick={e => { e.stopPropagation(); setShowSecond(s => !s); }}>
            <span className={`dot ${!showSecond ? 'dot-active' : ''}`} />
            <span className={`dot ${showSecond ? 'dot-active' : ''}`} />
          </div>
        )}
      </div>
      <div className="card-body">
        <span className="cat-label">{product.category}</span>
        <h2>{product.name}</h2>
        {product.size && <p className="size">{product.size}</p>}
        <p className="best-before">Best Before: {formatBB(product.bestBefore)}</p>
        {product.price > 0 && (
          <p className="price">R {Number(product.price).toFixed(2)}</p>
        )}
        {product.notes && <p className="notes">{product.notes}</p>}
        {cartQty === 0 ? (
          <button className="btn-add-cart" onClick={() => onAddToCart(product)}>+ Add to Order</button>
        ) : (
          <div className="card-stepper">
            <button onClick={() => onUpdateQty(product.id, cartQty - 1)}>−</button>
            <span>{cartQty}</span>
            <button onClick={() => onUpdateQty(product.id, cartQty + 1)}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CartDrawer({ cart, onClose, onUpdateQty, onRemove, onClear }: {
  cart: CartItem[];
  onClose: () => void;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const total = cart.reduce((sum, i) => sum + i.product.price * i.qty, 0);

  const message = [
    'Hi, I\'d like to order the following from Clearance Shop:',
    '',
    ...cart.map(i => `• ${i.product.name}${i.product.size ? ` (${i.product.size})` : ''} x${i.qty} — R${(i.product.price * i.qty).toFixed(2)}`),
    '',
    `Total: R${total.toFixed(2)}`,
    '',
    'Please confirm availability.',
  ].join('\n');

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

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
              <a href={waUrl} target="_blank" rel="noreferrer" className="btn-whatsapp">
                Order via WhatsApp
              </a>
              <button className="btn-clear-cart" onClick={onClear}>Clear order</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}


export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('newest');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setLightboxUrl(null);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxUrl]);


  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/products');
    setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    window.addEventListener('focus', fetchProducts);
    return () => window.removeEventListener('focus', fetchProducts);
  }, [fetchProducts]);

  function addToCart(product: Product) {
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

  const filtered = products
    .filter(p => {
      const expired = isExpired(p.bestBefore);
      return (
        (category === 'All' || p.category === category) &&
        (status === 'All' || (status === 'In Date' && !expired) || (status === 'Past Best Before' && expired)) &&
        (!search || p.name.toLowerCase().includes(search.toLowerCase()))
      );
    })
    .sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'expiry') {
        const da = a.bestBefore ? new Date(a.bestBefore).getTime() : Infinity;
        const db = b.bestBefore ? new Date(b.bestBefore).getTime() : Infinity;
        return da - db;
      }
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

  return (
    <>
      {lightboxUrl && (
        <div className="lightbox-backdrop" onClick={() => setLightboxUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)} aria-label="Close">✕</button>
        </div>
      )}

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
        <header className="site-header">
          <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Open order">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
          <span className="site-wordmark">CLEARANCE <span className="site-wordmark-pill">SHOP</span></span>
          <button className="cart-btn" onClick={() => { setSearchOpen(o => !o); if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 50); if (searchOpen) setSearch(''); }} aria-label="Search">
            {searchOpen
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            }
          </button>
        </header>

        <div className={`search-row${searchOpen ? ' open' : ''}`}>
          <input
            ref={searchRef}
            className="search-row-input"
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="mobile-filters">
          <select className="mobile-select" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'Category' : c}</option>)}
          </select>
          <select className="mobile-select" value={status} onChange={e => setStatus(e.target.value)}>
            {(['All', 'In Date', 'Past Best Before'] as const).map(s => <option key={s} value={s}>{s === 'All' ? 'Date' : s}</option>)}
          </select>
          <select className="mobile-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low→High</option>
            <option value="price-desc">Price: High→Low</option>
            <option value="expiry">Expiry: Soonest</option>
          </select>
        </div>

        <div className="body-layout">
          <aside className="sidebar">
            <div className="sidebar-section">
              <p className="sidebar-label">Category</p>
              {categories.map(c => (
                <button key={c} className={`sidebar-chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
                  {c === 'All' ? 'Category' : c}
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
                  {s === 'All' ? 'Date' : s}
                </button>
              ))}
            </div>
            <div className="sidebar-section">
              <p className="sidebar-label">Sort</p>
              {([['newest', 'Newest'], ['price-asc', 'Price: Low→High'], ['price-desc', 'Price: High→Low'], ['expiry', 'Expiry: Soonest']] as const).map(([val, label]) => (
                <button key={val} className={`sidebar-chip${sort === val ? ' active' : ''}`} onClick={() => setSort(val)}>
                  {label}
                </button>
              ))}
            </div>
          </aside>

          <main className="main-content">
            {loading && <p className="loading">Loading products…</p>}
            {!loading && filtered.length === 0 && (
              <p className="empty">{products.length === 0 ? 'No products yet — staff can add via the upload page.' : 'No products match the filters.'}</p>
            )}
            <div className="grid">
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onExpand={setLightboxUrl}
                  onAddToCart={addToCart}
                  cartQty={cart.find(i => i.product.id === product.id)?.qty ?? 0}
                  onUpdateQty={updateQty}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
