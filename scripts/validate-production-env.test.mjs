import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnv, validateProductionEnv } from './validate-production-env.mjs';

const base = {
  ACME_EMAIL: 'ops@example.com',
  APP_DOMAIN: 'app.example.com',
  API_DOMAIN: 'api.example.com',
  LIVEKIT_DOMAIN: 'livekit.example.com',
  OPERATOR_NAME: 'Example Operator',
  OPERATOR_CONTACT_URL: 'https://example.com/contact',
  PROJECT_REPOSITORY_URL: 'https://github.com/example/huddle',
  MAINTENANCE_OWNER_USER_ID: 'verified-owner-id',
};

test('accepts a complete production environment without a Control Agent release', () => {
  assert.deepEqual(validateProductionEnv(base), []);
});

test('parses documented inline comments without treating them as configuration', () => {
  assert.equal(parseEnv('APP_DOMAIN=app.example.com # public web\n').APP_DOMAIN, 'app.example.com');
});

test('rejects missing production metadata and malformed domains', () => {
  const errors = validateProductionEnv({ ...base, OPERATOR_NAME: '', API_DOMAIN: 'https://api.example.com', MAINTENANCE_OWNER_USER_ID: '' });
  assert.ok(errors.some((error) => error.includes('OPERATOR_NAME is required')));
  assert.ok(errors.some((error) => error.includes('API_DOMAIN must be a hostname')));
  assert.ok(errors.some((error) => error.includes('MAINTENANCE_OWNER_USER_ID is required')));
});

test('requires a complete signed release configuration', () => {
  const errors = validateProductionEnv({ ...base, CONTROL_AGENT_RELEASE_CHANNEL_URL: 'https://releases.example.com' });
  assert.ok(errors.some((error) => error.includes('all-or-none')));
});

test('requires the raw manifest-signing public key for a signed release', () => {
  const release = {
    CONTROL_AGENT_RELEASE_CHANNEL_URL: 'https://releases.example.com/channel',
    CONTROL_AGENT_RELEASES_URL: 'https://releases.example.com/releases',
    CONTROL_AGENT_ISSUES_URL: 'https://releases.example.com/issues',
  };
  const errors = validateProductionEnv({ ...base, ...release, CONTROL_AGENT_UPDATE_PUBLIC_KEY: Buffer.alloc(33).toString('base64') });
  assert.ok(errors.some((error) => error.includes('AGENT_UPDATE_PRIVATE_KEY_B64')));
  assert.deepEqual(validateProductionEnv({ ...base, ...release, CONTROL_AGENT_UPDATE_PUBLIC_KEY: Buffer.alloc(32).toString('base64') }), []);
});

test('requires TURN domain and certificates only when TURN is enabled', () => {
  const errors = validateProductionEnv({ ...base, TURN_ENABLED: 'true', TURN_DOMAIN: 'turn.example.com' }, { root: '/definitely-not-a-repository' });
  assert.equal(errors.filter((error) => error.includes('turn-certs')).length, 2);
  assert.deepEqual(validateProductionEnv({ ...base, TURN_ENABLED: 'false' }, { root: '/definitely-not-a-repository' }), []);
});

test('defaults to Compose Caddy and rejects an unknown front door', () => {
  assert.deepEqual(validateProductionEnv(base), []);
  const errors = validateProductionEnv({ ...base, HUDDLE_FRONT_DOOR: 'nginx' });
  assert.ok(errors.some((error) => error.includes('HUDDLE_FRONT_DOOR must be one of: compose, host')));
});
