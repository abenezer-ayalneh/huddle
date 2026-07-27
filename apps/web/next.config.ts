import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run `node server.js` without the full node_modules tree.
  // See infra/docker-compose.prod.yml and docs/SETUP.md (Phase 9 deploy).
  output: 'standalone',
  allowedDevOrigins: ['localhost', 'local-huddle.abenezer-ayalneh.dev'],
  // Turbopack development chunk filenames are reused while source changes.
  // The public Cloudflare test tunnel must not cache those mutable assets or a
  // second physical device can keep running a stale call client for hours.
  async headers() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
