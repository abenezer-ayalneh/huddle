function isUrl(value: unknown, protocols: string[]): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function validateEnvironment(env: Record<string, unknown>) {
  if (env.NODE_ENV !== 'production') return env;
  const errors: string[] = [];
  for (const key of ['WEB_ORIGIN', 'BETTER_AUTH_URL', 'GOOGLE_DRIVE_REDIRECT_URI']) {
    if (!isUrl(env[key], ['https:'])) errors.push(`${key} must be an HTTPS URL in production`);
  }
  if (!isUrl(env.LIVEKIT_URL, ['ws:'])) errors.push('LIVEKIT_URL must be an internal ws:// URL in production');
  if (!isUrl(env.LIVEKIT_PUBLIC_URL, ['wss:'])) errors.push('LIVEKIT_PUBLIC_URL must be a public wss:// URL in production');
  if (errors.length) throw new Error(`Invalid production environment: ${errors.join('; ')}`);
  return env;
}
