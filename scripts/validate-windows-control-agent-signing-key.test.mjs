import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { validateWindowsControlAgentSigningKey } from './validate-windows-control-agent-signing-key.mjs';

const signingEnvironment = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return {
    WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    WINDOWS_AGENT_UPDATE_PUBLIC_KEY: spki.subarray(spki.length - 32).toString('base64'),
    WINDOWS_AGENT_UPDATE_KEY_ID: 'windows-beta-2026-01',
  };
};

test('accepts a matching Ed25519 release key pair', () => {
  assert.deepEqual(validateWindowsControlAgentSigningKey(signingEnvironment()), { keyId: 'windows-beta-2026-01' });
});

test('rejects a public key that does not match the private key', () => {
  const environment = signingEnvironment();
  environment.WINDOWS_AGENT_UPDATE_PUBLIC_KEY = signingEnvironment().WINDOWS_AGENT_UPDATE_PUBLIC_KEY;
  assert.throws(() => validateWindowsControlAgentSigningKey(environment), /does not match/);
});

test('rejects missing and malformed release configuration without printing key material', () => {
  assert.throws(() => validateWindowsControlAgentSigningKey({}), /PRIVATE_KEY_B64 is required/);
  assert.throws(
    () => validateWindowsControlAgentSigningKey({ ...signingEnvironment(), WINDOWS_AGENT_UPDATE_KEY_ID: 'spaces are not allowed' }),
    /UPDATE_KEY_ID/,
  );
});
