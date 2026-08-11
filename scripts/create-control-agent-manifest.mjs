import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [version, releaseURL, outputDirectory = 'apps/control-agent/dist'] = process.argv.slice(2);
if (!version || !releaseURL) throw new Error('Usage: node scripts/create-control-agent-manifest.mjs VERSION RELEASE_URL [OUTPUT_DIRECTORY]');

const output = resolve(outputDirectory);
const artifact = (architecture) => {
  const filename = `Huddle-Control-Agent-macos-${architecture}.dmg`;
  const path = resolve(output, filename);
  const bytes = readFileSync(path);
  return {
    url: `${releaseURL}/${filename}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.length,
  };
};

const manifest = {
  schemaVersion: 1,
  channel: 'beta',
  keyId: requiredEnv('AGENT_UPDATE_KEY_ID'),
  version,
  minimumSupportedVersion: process.env.AGENT_MINIMUM_SUPPORTED_VERSION ?? version,
  minimumMacOS: '13.0',
  releasedAt: new Date().toISOString(),
  releaseNotesUrl: requiredEnv('AGENT_RELEASE_NOTES_URL'),
  downloads: {
    arm64: artifact('arm64'),
    x86_64: artifact('x86_64'),
  },
};

const data = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
const privateKeyBase64 = process.env.AGENT_UPDATE_PRIVATE_KEY_B64;
if (!privateKeyBase64) throw new Error('AGENT_UPDATE_PRIVATE_KEY_B64 is required to sign the release manifest');
const key = createPrivateKey({ key: Buffer.from(privateKeyBase64, 'base64'), format: 'der', type: 'pkcs8' });
const signature = sign(null, data, key).toString('base64');
writeFileSync(resolve(output, 'release-manifest.json'), data);
writeFileSync(resolve(output, 'release-manifest.sig'), `${signature}\n`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
