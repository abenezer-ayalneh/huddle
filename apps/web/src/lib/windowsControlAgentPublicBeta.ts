export type WindowsControlAgentArchitecture = 'x64' | 'arm64';
export type WindowsControlAgentPublicBeta = Record<WindowsControlAgentArchitecture, { downloadUrl: string; checksumUrl: string }>;

type GitHubRelease = {
  assets?: unknown;
  draft?: unknown;
  tag_name?: unknown;
};

function githubRepositoryPath(repositoryUrl: string): string | null {
  try {
    const repository = new URL(repositoryUrl);
    if (repository.protocol !== 'https:' || repository.hostname !== 'github.com') return null;
    const path = repository.pathname.replace(/^\/+|\/+$/g, '');
    return /^[^/]+\/[^/]+$/.test(path) ? path : null;
  } catch {
    return null;
  }
}

function hasInstallerAssets(release: GitHubRelease): release is GitHubRelease & { tag_name: string } {
  if (
    release.draft === true ||
    typeof release.tag_name !== 'string' ||
    !/^windows-control-agent-v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(release.tag_name)
  ) {
    return false;
  }
  if (!Array.isArray(release.assets)) return false;
  const names = new Set(release.assets.map((asset) => (asset && typeof asset === 'object' ? (asset as { name?: unknown }).name : undefined)));
  return [
    'Huddle-Control-Agent-windows-x64.exe',
    'Huddle-Control-Agent-windows-x64.exe.sha256',
    'Huddle-Control-Agent-windows-arm64.exe',
    'Huddle-Control-Agent-windows-arm64.exe.sha256',
  ].every((name) => names.has(name));
}

/**
 * The Downloads page follows the newest complete Windows prerelease. Each
 * installer has a SHA-256 sidecar, and all links remain on the configured
 * GitHub repository.
 */
export async function getWindowsControlAgentPublicBeta(repositoryUrl: string, fetchImpl: typeof fetch = fetch): Promise<WindowsControlAgentPublicBeta | null> {
  const path = githubRepositoryPath(repositoryUrl);
  if (!path) return null;

  try {
    const response = await fetchImpl(`https://api.github.com/repos/${path}/releases?per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return null;
    const release = payload.find(
      (candidate): candidate is GitHubRelease & { tag_name: string } =>
        !!candidate && typeof candidate === 'object' && hasInstallerAssets(candidate as GitHubRelease),
    );
    if (!release) return null;

    const installer = (architecture: WindowsControlAgentArchitecture) =>
      `https://github.com/${path}/releases/download/${release.tag_name}/Huddle-Control-Agent-windows-${architecture}.exe`;

    return {
      x64: { downloadUrl: installer('x64'), checksumUrl: `${installer('x64')}.sha256` },
      arm64: { downloadUrl: installer('arm64'), checksumUrl: `${installer('arm64')}.sha256` },
    };
  } catch {
    return null;
  }
}
