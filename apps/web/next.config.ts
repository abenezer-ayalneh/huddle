import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run `node server.js` without the full node_modules tree.
  // See infra/docker-compose.prod.yml and docs/SETUP.md (Phase 9 deploy).
  output: 'standalone',
  allowedDevOrigins: ['localhost', 'local-huddle.abenezer-ayalneh.dev'],
};

const canUploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT_WEB);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_WEB,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: true,
  widenClientFileUpload: canUploadSourceMaps,
  sourcemaps: {
    disable: !canUploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      removeTracing: true,
    },
  },
});
