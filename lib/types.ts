export interface Product {
  id: string;
  name: string;
  size: string;
  bestBefore: string; // YYYY-MM-DD
  category: string;
  notes: string;
  photoUrl: string;
  addedAt: string; // ISO
}
