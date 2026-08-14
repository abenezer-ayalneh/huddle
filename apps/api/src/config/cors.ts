const LOCAL_HTTP_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Resolve the API's CORS allowlist without making production permissive.
 *
 * Local browsers may address the same dev server as localhost, 127.0.0.1, or
 * ::1. When one of those loopback origins is configured, allow the equivalent
 * loopback origins on the same port. Non-loopback and production origins stay
 * exact. WEB_ORIGIN also accepts a comma-separated list for explicit setups.
 */
export function getCorsOrigins(configuredOrigin = 'http://localhost:3000', nodeEnv = process.env.NODE_ENV): string[] {
  const origins = configuredOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv === 'production') return [...new Set(origins)];

  const expanded = new Set(origins);
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' || !LOCAL_HTTP_HOSTS.includes(url.hostname)) continue;

      for (const host of LOCAL_HTTP_HOSTS) {
        url.hostname = host;
        expanded.add(url.origin);
      }
    } catch {
      // Preserve the existing behavior for invalid configuration and let the
      // CORS middleware handle it rather than failing API startup here.
    }
  }

  return [...expanded];
}
