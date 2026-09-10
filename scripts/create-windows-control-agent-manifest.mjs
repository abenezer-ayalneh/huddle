import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [version, releaseURL, outputDirectory = 'apps/control-agent-windows/dist'] = process.argv.slice(2);
if (!version || !releaseURL) throw new Error('Usage: node scripts/create-windows-control-agent-manifest.mjs VERSION RELEASE_URL [OUTPUT_DIRECTORY]');

const output = resolve(outputDirectory);
const artifact = (architecture) => {
  const filename = `Huddle-Control-Agent-windows-${architecture}.exe`;
  const bytes = readFileSync(resolve(output, filename));
  return {
    url: `${releaseURL}/${filename}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.length,
  };
};
const manifest = {
  schemaVersion: 1,
  channel: 'beta',
  keyId: requiredEnv('WINDOWS_AGENT_UPDATE_KEY_ID'),
  version,
  minimumSupportedVersion: process.env.WINDOWS_AGENT_MINIMUM_SUPPORTED_VERSION ?? version,
  minimumWindows: '10.0.19045',
  releasedAt: new Date().toISOString(),
  releaseNotesUrl: requiredEnv('WINDOWS_AGENT_RELEASE_NOTES_URL'),
  downloads: {
    x64: artifact('x64'),
    arm64: artifact('arm64'),
    x86: artifact('x86'),
  },
};

const data = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
const privateKeyBase64 = requiredEnv('WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64');
const key = createPrivateKey({ key: Buffer.from(privateKeyBase64, 'base64'), format: 'der', type: 'pkcs8' });
writeFileSync(resolve(output, 'release-manifest.json'), data);
writeFileSync(resolve(output, 'release-manifest.sig'), `${sign(null, data, key).toString('base64')}\n`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
