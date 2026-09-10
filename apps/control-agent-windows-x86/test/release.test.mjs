import assert from 'node:assert/strict';
import test from 'node:test';

import { checkRelease } from '../src/release.mjs';

const artifact = {
  url: 'https://downloads.example.test/Huddle-Control-Agent-windows-x86.exe',
  sha256: 'a'.repeat(64),
  sizeBytes: 42,
};

function installBrowserStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function response(bytes) {
  return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

test('requires a signed x86 artifact and preserves a channel path segment', async () => {
  installBrowserStorage();
  const urls = [];
  const manifest = new TextEncoder().encode(
    JSON.stringify({
      schemaVersion: 1,
      channel: 'beta',
      keyId: 'key-1',
      version: '0.2.0',
      minimumSupportedVersion: '0.1.0',
      minimumWindows: '10.0.19045',
      releasedAt: '2026-09-10T00:00:00.000Z',
      releaseNotesUrl: 'https://downloads.example.test/notes',
      downloads: { x86: artifact },
    }),
  );
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return response(String(url).endsWith('.json') ? manifest : new Uint8Array([1]));
  };
  const status = await checkRelease({
    currentVersion: '0.1.0',
    currentWindows: '10.0.19045',
    channelUrl: 'https://downloads.example.test/windows-control-agent-beta',
    publicKey: 'a'.repeat(44),
    verify: async () => true,
  });
  assert.equal(status.availableVersion, '0.2.0');
  assert.equal(status.missingNativeArchitecture, false);
  assert.deepEqual(urls, [
    'https://downloads.example.test/windows-control-agent-beta/release-manifest.json',
    'https://downloads.example.test/windows-control-agent-beta/release-manifest.sig',
  ]);
});

test('stops a configured x86 agent before bootstrap when the signed manifest omits x86', async () => {
  installBrowserStorage();
  const manifest = new TextEncoder().encode(
    JSON.stringify({
      schemaVersion: 1,
      channel: 'beta',
      keyId: 'key-1',
      version: '0.2.0',
      minimumSupportedVersion: '0.1.0',
      minimumWindows: '10.0.19045',
      releasedAt: '2026-09-10T00:00:00.000Z',
      releaseNotesUrl: 'https://downloads.example.test/notes',
      downloads: { x64: artifact },
    }),
  );
  globalThis.fetch = async (url) => response(String(url).endsWith('.json') ? manifest : new Uint8Array([1]));
  const status = await checkRelease({
    currentVersion: '0.1.0',
    currentWindows: '10.0.19045',
    channelUrl: 'https://downloads.example.test/windows-control-agent-beta',
    publicKey: 'a'.repeat(44),
    verify: async () => true,
  });
  assert.equal(status.missingNativeArchitecture, true);
});
