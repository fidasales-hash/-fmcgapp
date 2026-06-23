import { neon } from '@neondatabase/serverless';
import type { Product } from './types';

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
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db`SELECT * FROM products ORDER BY added_at DESC`;
  return rows.map(r => ({
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
    addedAt: String(r.added_at),
  }));
}

export async function insertProduct(p: Product) {
  await ensureTable();
  const db = getDb();
  await db`
    INSERT INTO products (id, name, size, best_before, category, notes, price, market_price, photo_url, photo_url_2, photo_url_3, barcode, added_at)
    VALUES (${p.id}, ${p.name}, ${p.size}, ${p.bestBefore || null}, ${p.category}, ${p.notes}, ${p.price}, ${p.marketPrice ?? 0}, ${p.photoUrl}, ${p.photoUrl2}, ${p.photoUrl3 ?? ''}, ${p.barcode ?? ''}, ${p.addedAt})
  `;
}

export async function updateProduct(id: string, u: Partial<Product>) {
  await ensureTable();
  const db = getDb();
  await db`
    UPDATE products SET
      name         = ${u.name ?? ''},
      size         = ${u.size ?? ''},
      best_before  = ${u.bestBefore || null},
      category     = ${u.category ?? 'Other'},
      notes        = ${u.notes ?? ''},
      price        = ${u.price ?? 0},
      market_price = ${u.marketPrice ?? 0}
    WHERE id = ${id}
  `;
}

export async function deleteProduct(id: string): Promise<{ photoUrl: string; photoUrl2: string; photoUrl3: string } | null> {
  await ensureTable();
  const db = getDb();
  const rows = await db`DELETE FROM products WHERE id = ${id} RETURNING photo_url, photo_url_2, photo_url_3`;
  if (!rows[0]) return null;
  return { photoUrl: String(rows[0].photo_url), photoUrl2: String(rows[0].photo_url_2 ?? ''), photoUrl3: String(rows[0].photo_url_3 ?? '') };
}
