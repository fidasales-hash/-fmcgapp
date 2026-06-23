import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/upload', '/admin', '/api/'],
    },
    sitemap: 'https://fmcgapp.vercel.app/sitemap.xml',
  };
}
