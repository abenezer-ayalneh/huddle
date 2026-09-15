import { createPrivateKey, createPublicKey, timingSafeEqual } from 'node:crypto';

const ed25519SpkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');

export function validateWindowsControlAgentSigningKey(env = process.env) {
  const privateKeyBytes = decodeBase64(required(env, 'WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64'), 'WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64');
  const publicKeyBytes = decodeBase64(required(env, 'WINDOWS_AGENT_UPDATE_PUBLIC_KEY'), 'WINDOWS_AGENT_UPDATE_PUBLIC_KEY');
  const keyId = required(env, 'WINDOWS_AGENT_UPDATE_KEY_ID');

  if (publicKeyBytes.length !== 32) {
    throw new Error('WINDOWS_AGENT_UPDATE_PUBLIC_KEY must contain exactly 32 Ed25519 public-key bytes.');
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId)) {
    throw new Error('WINDOWS_AGENT_UPDATE_KEY_ID must use 1-64 letters, numbers, dots, underscores, or hyphens.');
  }

  let privateKey;
  try {
    privateKey = createPrivateKey({ key: privateKeyBytes, format: 'der', type: 'pkcs8' });
  } catch {
    throw new Error('WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64 must be a base64-encoded PKCS#8 private key.');
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64 must contain an Ed25519 private key.');
  }

  const spki = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  if (spki.length !== ed25519SpkiPrefix.length + 32 || !spki.subarray(0, ed25519SpkiPrefix.length).equals(ed25519SpkiPrefix)) {
    throw new Error('Could not derive a raw Ed25519 public key from WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64.');
  }
  const derivedPublicKey = spki.subarray(ed25519SpkiPrefix.length);
  if (!timingSafeEqual(derivedPublicKey, publicKeyBytes)) {
    throw new Error('WINDOWS_AGENT_UPDATE_PUBLIC_KEY does not match WINDOWS_AGENT_UPDATE_PRIVATE_KEY_B64.');
  }

  return { keyId };
}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function decodeBase64(value, name) {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 0 || decoded.toString('base64') !== value) {
    throw new Error(`${name} must be canonical base64.`);
  }
  return decoded;
}

if (import.meta.main) {
  const { keyId } = validateWindowsControlAgentSigningKey();
  console.log(`Validated Windows Control Agent release signing key '${keyId}'.`);
}
