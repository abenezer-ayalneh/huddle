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

export const CONTROL_AGENT_RELEASE = publicConfig.controlAgentRelease;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
import { publicConfig } from './public-config';
