// A LiveKit participant identity must be unique within a room. We derive one
// from the display name plus a short random suffix so two people can use the
// same display name without colliding.
export function makeIdentity(displayName: string): string {
  const slug =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "guest";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug}-${suffix}`;
}
