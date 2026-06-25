import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';

// Dynamic sitemap. Only the public lobby is indexable — meeting rooms and the
// recordings dashboard are private and excluded by robots.ts. `lastModified` is
// computed at build time so it tracks deploys without manual edits.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
