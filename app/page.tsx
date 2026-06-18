'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/lib/types';

function isExpired(bestBefore: string) {
  return new Date(bestBefore) < new Date(new Date().toDateString());
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="lightbox-img" onClick={e => e.stopPropagation()} />
      <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [showSecond, setShowSecond] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const expired = isExpired(product.bestBefore);
  const hasTwo = Boolean(product.photoUrl2);
  const activeUrl = showSecond && product.photoUrl2 ? product.photoUrl2 : product.photoUrl;

  return (
    <div className={`card ${expired ? 'expired' : 'fresh'}`}>
      {lightbox && <Lightbox src={activeUrl} alt={product.name} onClose={() => setLightbox(false)} />}
      <div className="photo-wrap" style={{ cursor: 'pointer' }} onClick={() => setLightbox(true)}>
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
        <p className="best-before">
          Best Before: {product.bestBefore ? new Date(product.bestBefore + 'T00:00:00').toLocaleDateString('en-GB') : '—'}
        </p>
        {product.price > 0 && (
          <p className="price">R {Number(product.price).toFixed(2)}</p>
        )}
        {product.notes && <p className="notes">{product.notes}</p>}
      </div>
    </div>
  );
}

function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="hamburger-wrap">
      <button className="hamburger-btn" onClick={() => setOpen(o => !o)} aria-label="Menu">
        <span className={`hb-bar${open ? ' open' : ''}`} />
        <span className={`hb-bar${open ? ' open' : ''}`} />
        <span className={`hb-bar${open ? ' open' : ''}`} />
      </button>
      {open && (
        <>
          <div className="hamburger-backdrop" onClick={() => setOpen(false)} />
          <nav className="hamburger-menu">
            <a href="/upload" onClick={() => setOpen(false)}>Staff Upload</a>
            <a href="/admin" onClick={() => setOpen(false)}>Admin</a>
          </nav>
        </>
      )}
    </div>
  );
}

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');

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

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category))).sort()];

  const filtered = products.filter(p => {
    const expired = isExpired(p.bestBefore);
    return (
      (category === 'All' || p.category === category) &&
      (status === 'All' || (status === 'In Date' && !expired) || (status === 'Past Best Before' && expired))
    );
  });

  return (
    <>
      <header className="site-header">
        <HamburgerMenu />
        <img src="/logo.svg" alt="Clearance Shop" className="site-logo" />
        <p className="site-tagline">Great prices on surplus &amp; short-dated stock</p>
      </header>

      <div className="filters">
        <div className="filter-row">
          {categories.map(c => (
            <button key={c} className={`chip${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {(['All', 'In Date', 'Past Best Before'] as const).map(s => (
            <button
              key={s}
              className={`chip${status === s ? ' active' + (s === 'In Date' ? ' green' : s === 'Past Best Before' ? ' red' : '') : ''}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="loading">Loading products…</p>}
      {!loading && filtered.length === 0 && (
        <p className="empty">{products.length === 0 ? 'No products yet — staff can add via the upload page.' : 'No products match the filters.'}</p>
      )}

      <div className="grid">
        {filtered.map(product => <ProductCard key={product.id} product={product} />)}
      </div>
    </>
  );
}
