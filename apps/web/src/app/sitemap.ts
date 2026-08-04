import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';

// Dynamic sitemap. Public product and policy pages are indexable; meeting rooms,
// the host lobby, and the recordings dashboard are private/session-oriented and
// excluded by robots.ts. `lastModified` is computed at build time so it tracks
// deploys without manual edits.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${siteUrl}/downloads`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];
}
