import type { MetadataRoute } from 'next';
import { publicConfig } from '@/lib/public-config';

const { siteUrl } = publicConfig;

// Robots policy: public informational pages are indexable. /rooms/* are private
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
