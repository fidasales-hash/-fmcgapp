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
  photoUrl3: string;
  barcode: string;
  kosher: boolean;
  halal: boolean;
  vegan: boolean;
  addedAt: string; // ISO
  orderCount: number;
  inStock: boolean;   // false = sold out, shown as "Not available"
  sellerId: string;   // '' = shop's own stock
  sellerName: string; // '' = shop's own stock
}

export interface Seller {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  token: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string; // ISO
}
