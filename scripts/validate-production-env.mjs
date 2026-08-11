#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RELEASE_KEYS = [
  'CONTROL_AGENT_RELEASE_CHANNEL_URL',
  'CONTROL_AGENT_RELEASES_URL',
  'CONTROL_AGENT_ISSUES_URL',
  'CONTROL_AGENT_UPDATE_PUBLIC_KEY',
];

const REQUIRED_KEYS = ['ACME_EMAIL', 'APP_DOMAIN', 'API_DOMAIN', 'LIVEKIT_DOMAIN', 'OPERATOR_NAME', 'OPERATOR_CONTACT_URL', 'PROJECT_REPOSITORY_URL'];

export function parseEnv(source, file = '.env') {
  const env = {};
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) throw new Error(`${file}:${index + 1}: expected KEY=value`);
    const key = line.slice(0, separator).trim();
    let value = stripInlineComment(line.slice(separator + 1).trim());
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`${file}:${index + 1}: invalid environment key ${key}`);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function stripInlineComment(value) {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === '"' || character === "'") && value[index - 1] !== '\\') quote = quote === character ? '' : quote || character;
    if (character === '#' && !quote && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index).trimEnd();
  }
  return value;
}

function isDomain(value) {
  return typeof value === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isPublicKey(value) {
  try {
    return Buffer.from(value, 'base64').length === 32;
  } catch {
    return false;
  }
}

export function validateProductionEnv(env, { root = process.cwd() } = {}) {
  const errors = [];
  for (const key of REQUIRED_KEYS) if (!env[key]?.trim()) errors.push(`${key} is required`);
  for (const key of ['APP_DOMAIN', 'API_DOMAIN', 'LIVEKIT_DOMAIN']) {
    if (env[key] && !isDomain(env[key])) errors.push(`${key} must be a hostname without a scheme, path, or port`);
  }
  for (const key of ['OPERATOR_CONTACT_URL', 'PROJECT_REPOSITORY_URL']) {
    if (env[key] && !isHttpsUrl(env[key])) errors.push(`${key} must be an HTTPS URL`);
  }

  const configuredReleaseKeys = RELEASE_KEYS.filter((key) => Boolean(env[key]?.trim()));
  if (configuredReleaseKeys.length > 0 && configuredReleaseKeys.length !== RELEASE_KEYS.length) {
    errors.push(`Control Agent release configuration is all-or-none: ${RELEASE_KEYS.join(', ')}`);
  }
  if (configuredReleaseKeys.length === RELEASE_KEYS.length) {
    for (const key of RELEASE_KEYS.slice(0, 3)) if (!isHttpsUrl(env[key])) errors.push(`${key} must be an HTTPS URL`);
    if (!isPublicKey(env.CONTROL_AGENT_UPDATE_PUBLIC_KEY)) errors.push('CONTROL_AGENT_UPDATE_PUBLIC_KEY must be a base64-encoded 32-byte Ed25519 public key');
  }

  const turnEnabled = env.TURN_ENABLED ?? 'false';
  if (!['true', 'false'].includes(turnEnabled)) errors.push('TURN_ENABLED must be true or false');
  if (turnEnabled === 'true') {
    if (!isDomain(env.TURN_DOMAIN)) errors.push('TURN_DOMAIN must be a hostname when TURN_ENABLED=true');
    for (const file of [env.TURN_CERT_FILE ?? 'infra/turn-certs/cert.pem', env.TURN_KEY_FILE ?? 'infra/turn-certs/key.pem']) {
      if (!existsSync(resolve(root, file))) errors.push(`${file} is required when TURN_ENABLED=true`);
    }
  }
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const envIndex = args.indexOf('--env');
  const envFile = envIndex >= 0 ? args[envIndex + 1] : '.env.prod';
  if (!envFile) throw new Error('--env requires a file path');
  const source = readFileSync(envFile, 'utf8');
  const env = parseEnv(source, envFile);
  const errors = validateProductionEnv(env);
  if (errors.length) throw new Error(`Production configuration is invalid:\n- ${errors.join('\n- ')}`);
  if (args.includes('--print-ready-url')) process.stdout.write(`https://${env.API_DOMAIN}/ready\n`);
  else process.stdout.write(`Production configuration is valid for ${env.APP_DOMAIN}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
