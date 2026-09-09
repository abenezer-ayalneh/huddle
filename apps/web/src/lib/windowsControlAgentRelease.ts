import { createPublicKey, verify } from 'node:crypto';
import { WINDOWS_CONTROL_AGENT_RELEASE } from './windowsControlAgentReleaseShared';
import type { WindowsControlAgentRelease, WindowsControlAgentReleaseManifest } from './windowsControlAgentReleaseShared';
export type { WindowsControlAgentRelease, WindowsControlAgentReleaseManifest } from './windowsControlAgentReleaseShared';

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validVersion(value: unknown): value is string {
  return typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function validWindowsBuild(value: unknown): value is string {
  return typeof value === 'string' && /^10\.0\.\d{5,}$/.test(value);
}

function isManifest(value: unknown): value is WindowsControlAgentReleaseManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WindowsControlAgentReleaseManifest>;
  const artifact = candidate.downloads?.x64;
  return (
    candidate.schemaVersion === 1 &&
    candidate.channel === 'beta' &&
    typeof candidate.keyId === 'string' &&
    validVersion(candidate.version) &&
    validVersion(candidate.minimumSupportedVersion) &&
    validWindowsBuild(candidate.minimumWindows) &&
    Number.isFinite(Date.parse(candidate.releasedAt ?? '')) &&
    validHttpsUrl(candidate.releaseNotesUrl) &&
    !!artifact &&
    validHttpsUrl(artifact.url) &&
    typeof artifact.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(artifact.sha256) &&
    Number.isSafeInteger(artifact.sizeBytes) &&
    artifact.sizeBytes > 0
  );
}

function verifyManifest(bytes: Uint8Array, signature: Uint8Array, publicKeyBase64: string): boolean {
  try {
    const rawPublicKey = Buffer.from(publicKeyBase64, 'base64');
    if (rawPublicKey.length !== 32) return false;
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey]);
    return verify(null, Buffer.from(bytes), createPublicKey({ key: spki, format: 'der', type: 'spki' }), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function getWindowsControlAgentRelease(): Promise<WindowsControlAgentRelease | null> {
  if (!WINDOWS_CONTROL_AGENT_RELEASE) return null;
  try {
    const [manifestResponse, signatureResponse] = await Promise.all([
      fetch(`${WINDOWS_CONTROL_AGENT_RELEASE.channelUrl}/release-manifest.json`, { next: { revalidate: 3600 } }),
      fetch(`${WINDOWS_CONTROL_AGENT_RELEASE.channelUrl}/release-manifest.sig`, { next: { revalidate: 3600 } }),
    ]);
    if (!manifestResponse.ok || !signatureResponse.ok) return null;
    const bytes = new Uint8Array(await manifestResponse.arrayBuffer());
    const manifest = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isManifest(manifest)) return null;
    return {
      ...manifest,
      verified: verifyManifest(bytes, new Uint8Array(await signatureResponse.arrayBuffer()), WINDOWS_CONTROL_AGENT_RELEASE.updatePublicKey),
    };
  } catch {
    return null;
  }
}
