import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = 'https://clearanceshop.co.za';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Clearance Shop Johannesburg | Discounted FMCG & Short-Dated Stock',
    template: '%s | Clearance Shop JHB',
  },
  description:
    'Buy clearance & short-dated FMCG products at unbeatable prices. Collect from Glenhazel, Johannesburg. EFT, Cash & Yoco accepted.',
  keywords: [
    'clearance shop Johannesburg',
    'FMCG clearance',
    'short-dated food',
    'discounted groceries Johannesburg',
    'surplus stock Glenhazel',
    'cheap food JHB',
    'best before clearance',
  ],
  icons: { icon: '/logo.svg' },
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: SITE_URL,
    siteName: 'Clearance Shop JHB',
    title: 'Clearance Shop Johannesburg | Discounted FMCG & Short-Dated Stock',
    description:
      'Clearance & short-dated FMCG at unbeatable prices. Collect from Glenhazel, Johannesburg.',
  },
  twitter: {
    card: 'summary',
    title: 'Clearance Shop JHB | Discounted FMCG',
    description: 'Clearance & short-dated FMCG at great prices. Glenhazel, Johannesburg.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: 'Clearance Shop',
  description: 'Clearance and short-dated FMCG products at discounted prices',
  url: SITE_URL,
  telephone: '+27615807797',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Park Crescent',
    addressLocality: 'Glenhazel',
    addressRegion: 'Gauteng',
    addressCountry: 'ZA',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '16:00',
    },
  ],
  paymentAccepted: 'Credit and Debit Cards',
  currenciesAccepted: 'ZAR',
  priceRange: 'R',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
