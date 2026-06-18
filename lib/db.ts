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
      photo_url   TEXT NOT NULL,
      added_at    TEXT NOT NULL
    )
  `;
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureTable();
  const db = getDb();
  const rows = await db`SELECT * FROM products ORDER BY added_at DESC`;
  return rows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    size: String(r.size ?? ''),
    bestBefore: String(r.best_before).slice(0, 10),
    category: String(r.category ?? 'Other'),
    notes: String(r.notes ?? ''),
    photoUrl: String(r.photo_url),
    addedAt: String(r.added_at),
  }));
}

export async function insertProduct(p: Product) {
  await ensureTable();
  const db = getDb();
  await db`
    INSERT INTO products (id, name, size, best_before, category, notes, photo_url, added_at)
    VALUES (${p.id}, ${p.name}, ${p.size}, ${p.bestBefore}, ${p.category}, ${p.notes}, ${p.photoUrl}, ${p.addedAt})
  `;
}

export async function deleteProduct(id: string): Promise<string | null> {
  await ensureTable();
  const db = getDb();
  const rows = await db`DELETE FROM products WHERE id = ${id} RETURNING photo_url`;
  return rows[0] ? String(rows[0].photo_url) : null;
}
