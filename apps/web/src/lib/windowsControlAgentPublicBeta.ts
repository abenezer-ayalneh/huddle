import type { WindowsControlAgentArchitecture } from './windowsControlAgentReleaseShared';

export type WindowsControlAgentPublicBeta = Record<WindowsControlAgentArchitecture, { downloadUrl: string; checksumUrl: string }>;

/**
 * The first public Windows builds are intentionally separate architecture-only
 * prereleases. They have SHA-256 sidecars, but no signed dual-architecture
 * manifest channel yet, so they must never be presented as verified releases.
 */
export function getWindowsControlAgentPublicBeta(repositoryUrl: string): WindowsControlAgentPublicBeta | null {
  try {
    const repository = new URL(repositoryUrl);
    if (repository.protocol !== 'https:' || repository.hostname !== 'github.com') return null;
    const path = repository.pathname.replace(/^\/+|\/+$/g, '');
    if (!/^[^/]+\/[^/]+$/.test(path)) return null;

    const release = (architecture: WindowsControlAgentArchitecture) =>
      `https://github.com/${path}/releases/download/windows-control-agent-${architecture}-v0.1.0/Huddle-Control-Agent-windows-${architecture}.exe`;

    return {
      x64: {
        downloadUrl: release('x64'),
        checksumUrl: `${release('x64')}.sha256`,
      },
      arm64: {
        downloadUrl: release('arm64'),
        checksumUrl: `${release('arm64')}.sha256`,
      },
    };
  } catch {
    return null;
  }
}
