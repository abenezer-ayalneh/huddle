import { publicConfig } from './public-config';

export type WindowsControlAgentArchitecture = 'x64' | 'arm64' | 'x86';

export type WindowsControlAgentReleaseManifest = {
  schemaVersion: 1;
  channel: 'beta';
  keyId: string;
  version: string;
  minimumSupportedVersion: string;
  minimumWindows: string;
  releasedAt: string;
  releaseNotesUrl: string;
  downloads: Partial<Record<WindowsControlAgentArchitecture, { url: string; sha256: string; sizeBytes: number }>>;
};

export type WindowsControlAgentRelease = WindowsControlAgentReleaseManifest & { verified: boolean };

export const WINDOWS_CONTROL_AGENT_RELEASE = publicConfig.windowsControlAgentRelease;
