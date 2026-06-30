import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run `node server.js` without the full node_modules tree.
  // See infra/docker-compose.prod.yml and docs/SETUP.md (Phase 9 deploy).
  output: 'standalone',
  allowedDevOrigins: ['localhost', 'local-huddle.abenezer-ayalneh.dev'],
};

export default nextConfig;
