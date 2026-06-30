import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://huddle.abenezer-ayalneh.dev';

// Robots policy: index only the public landing page. /rooms/* are private
// meeting URLs that crawlers must not enumerate, and /lobby plus /recordings are
// session-oriented host views. AI search crawlers (GPTBot, ClaudeBot,
// PerplexityBot, Google-Extended) inherit the default allow-on-/ rule unless we
// explicitly need to block them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/rooms/', '/lobby', '/recordings'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
