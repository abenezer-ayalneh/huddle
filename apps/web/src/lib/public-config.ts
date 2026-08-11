type Environment = Record<string, string | undefined>;

export type ControlAgentReleaseConfig = {
  channelUrl: string;
  releasesUrl: string;
  issuesUrl: string;
  updatePublicKey: string;
};

export type PublicConfig = {
  siteUrl: string;
  apiUrl: string;
  authUrl: string;
  operatorName: string;
  operatorContactUrl: string;
  projectRepositoryUrl: string;
  controlAgentRelease: ControlAgentReleaseConfig | null;
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
  const releaseValues = {
    channelUrl: env.NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL?.trim() ?? '',
    releasesUrl: env.NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL?.trim() ?? '',
    issuesUrl: env.NEXT_PUBLIC_CONTROL_AGENT_ISSUES_URL?.trim() ?? '',
    updatePublicKey: env.NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY?.trim() ?? '',
  };
  const releaseCount = Object.values(releaseValues).filter(Boolean).length;
  if (releaseCount !== 0 && releaseCount !== 4) throw new Error('Control Agent release configuration must be all-or-none');
  if (releaseCount === 4) {
    for (const [name, value] of Object.entries(releaseValues).slice(0, 3)) {
      try {
        if (new URL(value).protocol !== 'https:') throw new Error('not HTTPS');
      } catch {
        throw new Error(`Control Agent ${name} must be an HTTPS URL`);
      }
    }
  }

  return {
    siteUrl: url(env, 'NEXT_PUBLIC_SITE_URL'),
    apiUrl: url(env, 'NEXT_PUBLIC_API_URL'),
    authUrl: url(env, 'NEXT_PUBLIC_AUTH_URL'),
    operatorName: required(env, 'NEXT_PUBLIC_OPERATOR_NAME'),
    operatorContactUrl: url(env, 'NEXT_PUBLIC_OPERATOR_CONTACT_URL'),
    projectRepositoryUrl: url(env, 'NEXT_PUBLIC_PROJECT_REPOSITORY_URL'),
    controlAgentRelease: releaseCount === 4 ? releaseValues : null,
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
  NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL: process.env.NEXT_PUBLIC_CONTROL_AGENT_RELEASE_CHANNEL_URL,
  NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL: process.env.NEXT_PUBLIC_CONTROL_AGENT_RELEASES_URL,
  NEXT_PUBLIC_CONTROL_AGENT_ISSUES_URL: process.env.NEXT_PUBLIC_CONTROL_AGENT_ISSUES_URL,
  NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY: process.env.NEXT_PUBLIC_CONTROL_AGENT_UPDATE_PUBLIC_KEY,
};

export const publicConfig = readPublicConfig(publicEnvironment);
