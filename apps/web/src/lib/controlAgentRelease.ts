import { createPublicKey, verify } from 'node:crypto';
import { CONTROL_AGENT_RELEASE } from './controlAgentReleaseShared';
import type { ControlAgentRelease, ControlAgentReleaseManifest } from './controlAgentReleaseShared';
export type { ControlAgentRelease, ControlAgentReleaseManifest } from './controlAgentReleaseShared';

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isManifest(value: unknown): value is ControlAgentReleaseManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ControlAgentReleaseManifest>;
  if (
    candidate.schemaVersion !== 1 ||
    candidate.channel !== 'beta' ||
    typeof candidate.keyId !== 'string' ||
    typeof candidate.version !== 'string' ||
    typeof candidate.minimumSupportedVersion !== 'string' ||
    typeof candidate.minimumMacOS !== 'string' ||
    typeof candidate.releasedAt !== 'string' ||
    !validHttpsUrl(candidate.releaseNotesUrl) ||
    !candidate.downloads
  )
    return false;

  for (const architecture of ['arm64', 'x86_64'] as const) {
    const download = candidate.downloads[architecture];
    if (
      !download ||
      !validHttpsUrl(download.url) ||
      typeof download.sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(download.sha256) ||
      typeof download.sizeBytes !== 'number'
    ) {
      return false;
    }
  }
  return Number.isFinite(Date.parse(candidate.releasedAt));
}

function verifyManifest(bytes: Uint8Array, signature: Uint8Array, publicKeyBase64: string): boolean {
  try {
    const rawPublicKey = Buffer.from(publicKeyBase64, 'base64');
    if (rawPublicKey.length !== 32) return false;
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPublicKey]);
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return verify(null, Buffer.from(bytes), key, Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function getControlAgentRelease(): Promise<ControlAgentRelease | null> {
  if (!CONTROL_AGENT_RELEASE) return null;
  try {
    const manifestResponse = await fetch(`${CONTROL_AGENT_RELEASE.channelUrl}/release-manifest.json`, { next: { revalidate: 3600 } });
    const signatureResponse = await fetch(`${CONTROL_AGENT_RELEASE.channelUrl}/release-manifest.sig`, { next: { revalidate: 3600 } });
    if (!manifestResponse.ok || !signatureResponse.ok) return null;
    const bytes = new Uint8Array(await manifestResponse.arrayBuffer());
    const manifestText = new TextDecoder().decode(bytes);
    const manifest = JSON.parse(manifestText) as unknown;
    if (!isManifest(manifest)) return null;
    const signature = new Uint8Array(await signatureResponse.arrayBuffer());
    return { ...manifest, verified: verifyManifest(bytes, signature, CONTROL_AGENT_RELEASE.updatePublicKey) };
  } catch {
    return null;
  }
}
