'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/sellers', label: 'Sellers' },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="admin-nav">
      <div className="admin-nav-inner">
        <div className="admin-nav-brand">
          <strong>Clearance Shop</strong>
          <span>Admin</span>
        </div>
        <nav aria-label="Admin">
          {TABS.map(t => (
            <Link
              key={t.href}
              href={t.href}
              className={pathname === t.href ? 'active' : undefined}
              aria-current={pathname === t.href ? 'page' : undefined}
            >
              {t.label}
            </Link>
          ))}
          <a href={`/?from=${encodeURIComponent(pathname)}`}>View store ↗</a>
        </nav>
      </div>
    </header>
  );
}
