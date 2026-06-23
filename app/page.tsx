import { getAllProducts } from '@/lib/db';
import StorefrontClient from './StorefrontClient';

export const revalidate = 60;

export default async function Page() {
  const products = await getAllProducts();
  return <StorefrontClient initialProducts={products} />;
}
