// Client-side save helpers for editing a product in place (shop edit mode).
// Same routes as the admin Products page; all need the admin sign-in.
import type { Product } from '@/lib/types';
import { compressImage } from '@/components/CameraSlot';

// The PATCH route overwrites every field, so the whole product is sent.
function productFormData(p: Product): FormData {
  const fd = new FormData();
  fd.append('name', p.name);
  fd.append('size', p.size ?? '');
  fd.append('bestBefore', p.bestBefore ?? '');
  fd.append('category', p.category);
  fd.append('notes', p.notes ?? '');
  fd.append('price', String(Number(p.price) || 0));
  fd.append('marketPrice', String(Number(p.marketPrice) || 0));
  fd.append('barcode', p.barcode ?? '');
  fd.append('kosher', p.kosher ? 'true' : 'false');
  fd.append('halal', p.halal ? 'true' : 'false');
  fd.append('vegan', p.vegan ? 'true' : 'false');
  return fd;
}

async function patch(id: string, fd: FormData): Promise<{ photoUrl?: string; photoUrl2?: string; photoUrl3?: string }> {
  const res = await fetch(`/api/products/${id}`, { method: 'PATCH', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data;
}

export async function saveProductFields(p: Product): Promise<void> {
  await patch(p.id, productFormData(p));
}

// slot 1 = main photo, 2 and 3 = extra photos. Shrunk before upload.
export async function saveProductPhoto(p: Product, slot: 1 | 2 | 3, file: File) {
  const fd = productFormData(p);
  fd.append(`photo${slot}`, await compressImage(file));
  return patch(p.id, fd);
}

export async function clearProductPhoto(p: Product, slot: 2 | 3) {
  const fd = productFormData(p);
  fd.append(`clear${slot}`, 'true');
  return patch(p.id, fd);
}

// Turns a photo a quarter turn to the left and returns it as a new file.
export async function rotatedPhoto(url: string): Promise<File> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('load')); img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(0, canvas.height);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
  if (!blob) throw new Error('rotate');
  return new File([blob], 'rotated.jpg', { type: 'image/jpeg' });
}

export async function saveProductQuantity(id: string, quantity: number | null): Promise<void> {
  const res = await fetch(`/api/products/${id}/quantity`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }),
  });
  if (!res.ok) throw new Error('Save failed');
}

export async function saveProductStock(id: string, inStock: boolean): Promise<void> {
  const res = await fetch(`/api/products/${id}/stock`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inStock }),
  });
  if (!res.ok) throw new Error('Save failed');
}

export async function removeProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Remove failed');
}
