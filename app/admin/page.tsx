import { redirect } from 'next/navigation';

// Temporary: the product manager now lives at /admin/products.
// This will become the admin dashboard.
export default function AdminIndex() {
  redirect('/admin/products');
}
