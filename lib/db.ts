import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import type { Product, Seller } from './types';

function getDb() {
  const url =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ?? '';
  if (!url) throw new Error('No database URL set. Check POSTGRES_URL in Vercel environment variables.');
  return neon(url);
}

async function ensureTable() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      size        TEXT DEFAULT '',
      best_before TEXT NOT NULL,
      category    TEXT DEFAULT 'Other',
      notes       TEXT DEFAULT '',
      price       NUMERIC DEFAULT 0,
      photo_url   TEXT NOT NULL,
      photo_url_2 TEXT DEFAULT '',
      added_at    TEXT NOT NULL
    )
  `;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url_2 TEXT DEFAULT ''`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url_3 TEXT DEFAULT ''`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS market_price NUMERIC DEFAULT 0`;
  await db`ALTER TABLE products ALTER COLUMN best_before DROP NOT NULL`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT DEFAULT ''`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS kosher BOOLEAN DEFAULT false`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS halal BOOLEAN DEFAULT false`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS vegan BOOLEAN DEFAULT false`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id TEXT DEFAULT ''`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN DEFAULT true`;
  await db`ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER`;
  await db`CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)`;
  await db`
    CREATE TABLE IF NOT EXISTS sellers (
      id            TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      contact_name  TEXT DEFAULT '',
      phone         TEXT DEFAULT '',
      email         TEXT DEFAULT '',
      token         TEXT UNIQUE NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TEXT NOT NULL
    )
  `;
}

function mapProductRow(r: any): Product {
  return {
    id: String(r.id),
    name: String(r.name),
    size: String(r.size ?? ''),
    bestBefore: (() => {
      const v = r.best_before;
      if (!v) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      const s = String(v);
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
    })(),
    category: String(r.category ?? 'Other'),
    notes: String(r.notes ?? ''),
    price: Number(r.price ?? 0),
    marketPrice: Number(r.market_price ?? 0),
    photoUrl: String(r.photo_url),
    photoUrl2: String(r.photo_url_2 ?? ''),
    photoUrl3: String(r.photo_url_3 ?? ''),
    barcode: String(r.barcode ?? ''),
    kosher: Boolean(r.kosher),
    halal: Boolean(r.halal),
    vegan: Boolean(r.vegan),
    addedAt: String(r.added_at),
    orderCount: Number(r.order_count ?? 0),
    inStock: r.in_stock !== false,
    quantity: r.quantity == null ? null : Number(r.quantity),
    sellerId: String(r.seller_id ?? ''),
    sellerName: String(r.seller_name ?? ''),
  };
}

function mapSellerRow(r: any): Seller {
  return {
    id: String(r.id),
    businessName: String(r.business_name),
    contactName: String(r.contact_name ?? ''),
    phone: String(r.phone ?? ''),
    email: String(r.email ?? ''),
    token: String(r.token),
    status: (r.status as Seller['status']) ?? 'pending',
    createdAt: String(r.created_at),
  };
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db`
    SELECT p.*, s.business_name AS seller_name
    FROM products p
    LEFT JOIN sellers s ON s.id = p.seller_id
    ORDER BY p.added_at DESC
  `;
  return rows.map(mapProductRow);
}

export async function getProductsBySeller(sellerId: string): Promise<Product[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db`
    SELECT p.*, s.business_name AS seller_name
    FROM products p
    LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE p.seller_id = ${sellerId}
    ORDER BY p.added_at DESC
  `;
  return rows.map(mapProductRow);
}

export async function insertProduct(p: Product) {
  await ensureTable();
  const db = getDb();
  await db`
    INSERT INTO products (id, name, size, best_before, category, notes, price, market_price, photo_url, photo_url_2, photo_url_3, barcode, kosher, halal, vegan, seller_id, added_at, quantity)
    VALUES (${p.id}, ${p.name}, ${p.size}, ${p.bestBefore || null}, ${p.category}, ${p.notes}, ${p.price}, ${p.marketPrice ?? 0}, ${p.photoUrl}, ${p.photoUrl2}, ${p.photoUrl3 ?? ''}, ${p.barcode ?? ''}, ${p.kosher ?? false}, ${p.halal ?? false}, ${p.vegan ?? false}, ${p.sellerId ?? ''}, ${p.addedAt}, ${p.quantity ?? null})
  `;
}

export async function getProductPhotoUrls(id: string): Promise<{ photoUrl: string; photoUrl2: string; photoUrl3: string } | null> {
  const db = getDb();
  const rows = await db`SELECT photo_url, photo_url_2, photo_url_3 FROM products WHERE id = ${id}`;
  if (!rows[0]) return null;
  return {
    photoUrl: String(rows[0].photo_url ?? ''),
    photoUrl2: String(rows[0].photo_url_2 ?? ''),
    photoUrl3: String(rows[0].photo_url_3 ?? ''),
  };
}

// Like getProductPhotoUrls, but includes seller_id so a seller-scoped route can
// verify ownership BEFORE mutating Blob storage (deleting/replacing a photo).
// Ownership must be checked here, not left to updateProduct's WHERE clause alone —
// that clause protects the DB row, but blob deletes happen as a separate step that
// would otherwise run before the ownership-scoped UPDATE ever executes.
export async function getProductOwnership(id: string): Promise<{ sellerId: string; photoUrl: string; photoUrl2: string; photoUrl3: string } | null> {
  const db = getDb();
  const rows = await db`SELECT seller_id, photo_url, photo_url_2, photo_url_3 FROM products WHERE id = ${id}`;
  if (!rows[0]) return null;
  return {
    sellerId: String(rows[0].seller_id ?? ''),
    photoUrl: String(rows[0].photo_url ?? ''),
    photoUrl2: String(rows[0].photo_url_2 ?? ''),
    photoUrl3: String(rows[0].photo_url_3 ?? ''),
  };
}

// sellerId, when passed, scopes the update to that seller's own rows (COALESCE makes
// it a no-op filter when omitted, so existing admin call sites are unaffected).
// Returns whether a row actually matched — callers scoped by sellerId use this to
// tell "not found" apart from "belongs to someone else" (both look like 0 rows).
export async function updateProduct(id: string, u: Partial<Product>, sellerId?: string): Promise<boolean> {
  await ensureTable();
  const db = getDb();
  const scope = sellerId ?? null;
  if (u.photoUrl !== undefined) {
    const rows = await db`
      UPDATE products SET
        name         = ${u.name ?? ''},
        size         = ${u.size ?? ''},
        best_before  = ${u.bestBefore || null},
        category     = ${u.category ?? 'Other'},
        notes        = ${u.notes ?? ''},
        price        = ${u.price ?? 0},
        market_price = ${u.marketPrice ?? 0},
        barcode      = ${u.barcode ?? ''},
        kosher       = ${u.kosher ?? false},
        halal        = ${u.halal ?? false},
        vegan        = ${u.vegan ?? false},
        photo_url    = ${u.photoUrl ?? ''},
        photo_url_2  = ${u.photoUrl2 ?? ''},
        photo_url_3  = ${u.photoUrl3 ?? ''}
      WHERE id = ${id} AND seller_id = COALESCE(${scope}, seller_id)
      RETURNING id
    `;
    return rows.length > 0;
  } else {
    const rows = await db`
      UPDATE products SET
        name         = ${u.name ?? ''},
        size         = ${u.size ?? ''},
        best_before  = ${u.bestBefore || null},
        category     = ${u.category ?? 'Other'},
        notes        = ${u.notes ?? ''},
        price        = ${u.price ?? 0},
        market_price = ${u.marketPrice ?? 0},
        barcode      = ${u.barcode ?? ''},
        kosher       = ${u.kosher ?? false},
        halal        = ${u.halal ?? false},
        vegan        = ${u.vegan ?? false}
      WHERE id = ${id} AND seller_id = COALESCE(${scope}, seller_id)
      RETURNING id
    `;
    return rows.length > 0;
  }
}

// Stock-only toggle — kept separate from updateProduct, which overwrites every field.
// sellerId scopes to that seller's own rows (same COALESCE trick as updateProduct).
export async function setProductStock(id: string, inStock: boolean, sellerId?: string): Promise<boolean> {
  await ensureTable();
  const db = getDb();
  const scope = sellerId ?? null;
  const rows = await db`
    UPDATE products SET in_stock = ${inStock}
    WHERE id = ${id} AND seller_id = COALESCE(${scope}, seller_id)
    RETURNING id
  `;
  return rows.length > 0;
}

// Quantity-only update — like setProductStock, kept apart from updateProduct.
export async function setProductQuantity(id: string, quantity: number | null): Promise<boolean> {
  await ensureTable();
  const db = getDb();
  const rows = await db`UPDATE products SET quantity = ${quantity} WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function getProductByBarcode(barcode: string): Promise<{ id: string; name: string } | null> {
  if (!barcode) return null;
  await ensureTable();
  const db = getDb();
  const rows = await db`SELECT id, name FROM products WHERE barcode = ${barcode} LIMIT 1`;
  if (!rows[0]) return null;
  return { id: String(rows[0].id), name: String(rows[0].name) };
}

export async function incrementOrderCount(id: string): Promise<void> {
  const db = getDb();
  await db`UPDATE products SET order_count = order_count + 1 WHERE id = ${id}`;
}

export async function deleteProduct(id: string, sellerId?: string): Promise<{ photoUrl: string; photoUrl2: string; photoUrl3: string } | null> {
  await ensureTable();
  const db = getDb();
  const scope = sellerId ?? null;
  const rows = await db`
    DELETE FROM products
    WHERE id = ${id} AND seller_id = COALESCE(${scope}, seller_id)
    RETURNING photo_url, photo_url_2, photo_url_3
  `;
  if (!rows[0]) return null;
  return { photoUrl: String(rows[0].photo_url), photoUrl2: String(rows[0].photo_url_2 ?? ''), photoUrl3: String(rows[0].photo_url_3 ?? '') };
}

export async function createSeller(input: { businessName: string; contactName: string; phone: string; email: string }): Promise<Seller> {
  await ensureTable();
  const db = getDb();
  const id = Date.now().toString();
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date().toISOString();
  await db`
    INSERT INTO sellers (id, business_name, contact_name, phone, email, token, status, created_at)
    VALUES (${id}, ${input.businessName}, ${input.contactName}, ${input.phone}, ${input.email}, ${token}, 'pending', ${createdAt})
  `;
  return { id, businessName: input.businessName, contactName: input.contactName, phone: input.phone, email: input.email, token, status: 'pending', createdAt };
}

// Admin-only: includes each seller's bearer token. Never expose this via a public route.
export async function getAllSellers(): Promise<Seller[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db`SELECT * FROM sellers ORDER BY created_at DESC`;
  return rows.map(mapSellerRow);
}

export async function getSellerByToken(token: string): Promise<Seller | null> {
  if (!token) return null;
  await ensureTable();
  const db = getDb();
  const rows = await db`SELECT * FROM sellers WHERE token = ${token} LIMIT 1`;
  if (!rows[0]) return null;
  return mapSellerRow(rows[0]);
}

export async function updateSellerStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
  await ensureTable();
  const db = getDb();
  await db`UPDATE sellers SET status = ${status} WHERE id = ${id}`;
}
