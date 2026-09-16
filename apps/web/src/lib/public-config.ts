type Environment = Record<string, string | undefined>;

export type PublicConfig = {
  siteUrl: string;
  apiUrl: string;
  authUrl: string;
  operatorName: string;
  operatorContactUrl: string;
  projectRepositoryUrl: string;
};

function required(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the Huddle web application`);
  return value;
}

function url(env: Environment, name: string): string {
  const value = required(env, name);
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`${name} must be an HTTP(S) URL`);
  }
}

export function readPublicConfig(env: Environment = process.env): PublicConfig {
  return {
    siteUrl: url(env, 'NEXT_PUBLIC_SITE_URL'),
    apiUrl: url(env, 'NEXT_PUBLIC_API_URL'),
    authUrl: url(env, 'NEXT_PUBLIC_AUTH_URL'),
    operatorName: required(env, 'NEXT_PUBLIC_OPERATOR_NAME'),
    operatorContactUrl: url(env, 'NEXT_PUBLIC_OPERATOR_CONTACT_URL'),
    projectRepositoryUrl: url(env, 'NEXT_PUBLIC_PROJECT_REPOSITORY_URL'),
  };
}

// Next.js replaces explicitly named NEXT_PUBLIC_* references in client bundles.
// Do not pass `process.env` directly here: its dynamic keys are not available in
// browser code, even though they are present during server rendering.
const publicEnvironment: Environment = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  NEXT_PUBLIC_OPERATOR_NAME: process.env.NEXT_PUBLIC_OPERATOR_NAME,
  NEXT_PUBLIC_OPERATOR_CONTACT_URL: process.env.NEXT_PUBLIC_OPERATOR_CONTACT_URL,
  NEXT_PUBLIC_PROJECT_REPOSITORY_URL: process.env.NEXT_PUBLIC_PROJECT_REPOSITORY_URL,
};

export const publicConfig = readPublicConfig(publicEnvironment);
