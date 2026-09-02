export type NoCostControlAgentBeta = {
  downloadUrl: string;
  checksumUrl: string;
};

/**
 * The public arm64 beta is intentionally separate from the signed/notarized
 * release-manifest channel. It is a fixed GitHub prerelease with a published
 * checksum, not a fallback for a configured-but-invalid signed release.
 */
export function getNoCostControlAgentBeta(repositoryUrl: string): NoCostControlAgentBeta | null {
  try {
    const repository = new URL(repositoryUrl);
    if (repository.protocol !== 'https:' || repository.hostname !== 'github.com') return null;
    const path = repository.pathname.replace(/^\/+|\/+$/g, '');
    if (!/^[^/]+\/[^/]+$/.test(path)) return null;
    const release = `https://github.com/${path}/releases/download/control-agent-free-beta`;
    return {
      downloadUrl: `${release}/Huddle-Control-Agent-macos-arm64.dmg`,
      checksumUrl: `${release}/Huddle-Control-Agent-macos-arm64.dmg.sha256`,
    };
  } catch {
    return null;
  }
}
