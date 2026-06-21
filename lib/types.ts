export interface Product {
  id: string;
  name: string;
  size: string;
  bestBefore: string; // YYYY-MM-DD
  category: string;
  notes: string;
  price: number;       // ZAR clearance price
  marketPrice: number; // ZAR normal retail price
  photoUrl: string;
  photoUrl2: string;
  addedAt: string; // ISO
}
