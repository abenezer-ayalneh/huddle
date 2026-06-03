import { randomBytes } from 'node:crypto';

// A LiveKit participant identity must be unique within a room. Derive one from
// the display name plus a short random suffix. Mirrors the web helper, but the
// server owns identity for managed rooms so guests can't collide or spoof.
export function makeIdentity(displayName: string): string {
  const slug =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'guest';
  const suffix = randomBytes(4).toString('hex');
  return `${slug}-${suffix}`;
}
