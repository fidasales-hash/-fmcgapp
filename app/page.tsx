import { getAllProducts } from '@/lib/db';
import StorefrontClient from './StorefrontClient';
import type { Metadata } from 'next';

const SITE_URL = 'https://clearanceshop.co.za';

type Props = { searchParams: Promise<{ category?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { category } = await searchParams;
  if (!category || category === 'All') return {};
  return {
    title: `Clearance ${category} Johannesburg`,
    description: `Buy discounted ${category} at clearance prices. Collect from Glenhazel, Johannesburg.`,
    alternates: { canonical: `${SITE_URL}/?category=${encodeURIComponent(category)}` },
  };
}

export const revalidate = 30;

export default async function Page({ searchParams }: Props) {
  const { category } = await searchParams;
  const products = await getAllProducts();
  return <StorefrontClient initialProducts={products} initialCategory={category || 'All'} />;
}
