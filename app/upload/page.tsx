import { redirect } from 'next/navigation';

// The old Add product page is gone: products are added from the Products page
// (yellow new row) or from the shop's Edit mode. Old links land on Products.
export default function UploadPage() {
  redirect('/admin/products');
}
