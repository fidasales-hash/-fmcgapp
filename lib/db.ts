import { neon } from '@neondatabase/serverless';
import type { Product } from './types';

function sql() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';
  return neon(url);
}

async function ensureTable() {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS products (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      size        TEXT DEFAULT '',
      best_before DATE NOT NULL,
      category    TEXT DEFAULT 'Other',
      notes       TEXT DEFAULT '',
      photo_url   TEXT NOT NULL,
      added_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureTable();
  const rows = await sql()`SELECT * FROM products ORDER BY added_at DESC`;
  return rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    size: (r.size ?? '') as string,
    bestBefore: (r.best_before as Date).toISOString().slice(0, 10),
    category: (r.category ?? 'Other') as string,
    notes: (r.notes ?? '') as string,
    photoUrl: r.photo_url as string,
    addedAt: r.added_at as string,
  }));
}

export async function insertProduct(p: Product) {
  await ensureTable();
  await sql()`
    INSERT INTO products (id, name, size, best_before, category, notes, photo_url, added_at)
    VALUES (${p.id}, ${p.name}, ${p.size}, ${p.bestBefore}, ${p.category}, ${p.notes}, ${p.photoUrl}, ${p.addedAt})
  `;
}

export async function deleteProduct(id: string): Promise<string | null> {
  await ensureTable();
  const rows = await sql()`DELETE FROM products WHERE id = ${id} RETURNING photo_url`;
  return (rows[0]?.photo_url as string) ?? null;
}
