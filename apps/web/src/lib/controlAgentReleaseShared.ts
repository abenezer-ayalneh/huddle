export type ControlAgentArchitecture = 'arm64' | 'x86_64';

export type ControlAgentReleaseManifest = {
  schemaVersion: 1;
  channel: 'beta';
  keyId: string;
  version: string;
  minimumSupportedVersion: string;
  minimumMacOS: string;
  releasedAt: string;
  releaseNotesUrl: string;
  downloads: Record<ControlAgentArchitecture, { url: string; sha256: string; sizeBytes: number }>;
};

export type ControlAgentRelease = ControlAgentReleaseManifest & { verified: boolean };

export const CONTROL_AGENT_RELEASE_CHANNEL_URL =
  process.env.NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL ?? 'https://github.com/abenezer-ayalneh/huddle/releases/download/control-agent-beta';
export const CONTROL_AGENT_RELEASES_URL = process.env.NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL ?? 'https://github.com/abenezer-ayalneh/huddle/releases';
// This is deliberately separate from the signed update channel. It is the
// zero-cost, Apple-Silicon-only public beta: its DMG is ad-hoc signed and not
// notarized, so the Downloads page must never present it as an identified app.
export const CONTROL_AGENT_FREE_BETA_TAG = 'control-agent-free-beta';
export const CONTROL_AGENT_FREE_BETA_DOWNLOAD_URL = `https://github.com/abenezer-ayalneh/huddle/releases/download/${CONTROL_AGENT_FREE_BETA_TAG}/Huddle-Control-Agent-macos-arm64.dmg`;
export const CONTROL_AGENT_FREE_BETA_CHECKSUM_URL = `https://github.com/abenezer-ayalneh/huddle/releases/download/${CONTROL_AGENT_FREE_BETA_TAG}/Huddle-Control-Agent-macos-arm64.dmg.sha256`;
export const CONTROL_AGENT_ISSUES_URL = 'https://github.com/abenezer-ayalneh/huddle/issues/new?template=control-agent-beta.yml';

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
