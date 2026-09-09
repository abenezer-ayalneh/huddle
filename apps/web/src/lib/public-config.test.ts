import { beforeAll, describe, expect, it } from 'vitest';

type ReadPublicConfig = typeof import('./public-config').readPublicConfig;

const baseEnvironment = {
  NEXT_PUBLIC_SITE_URL: 'https://huddle.example',
  NEXT_PUBLIC_API_URL: 'https://api.huddle.example',
  NEXT_PUBLIC_AUTH_URL: 'https://api.huddle.example',
  NEXT_PUBLIC_OPERATOR_NAME: 'Huddle',
  NEXT_PUBLIC_OPERATOR_CONTACT_URL: 'https://huddle.example/contact',
  NEXT_PUBLIC_PROJECT_REPOSITORY_URL: 'https://github.com/example/huddle',
};

let readPublicConfig: ReadPublicConfig;

beforeAll(async () => {
  Object.assign(process.env, baseEnvironment);
  ({ readPublicConfig } = await import('./public-config'));
});

describe('Windows Control Agent release configuration', () => {
  it('requires the separate Windows channel to be complete', () => {
    expect(() =>
      readPublicConfig({
        ...baseEnvironment,
        NEXT_PUBLIC_WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL: 'https://example.com/windows',
      }),
    ).toThrow('Windows Control Agent release configuration must be all-or-none');
  });

  it('keeps the signed Windows manifest channel distinct from macOS', () => {
    const config = readPublicConfig({
      ...baseEnvironment,
      NEXT_PUBLIC_WINDOWS_CONTROL_AGENT_RELEASE_CHANNEL_URL: 'https://example.com/windows',
      NEXT_PUBLIC_WINDOWS_CONTROL_AGENT_RELEASES_URL: 'https://github.com/example/huddle/releases',
      NEXT_PUBLIC_WINDOWS_CONTROL_AGENT_ISSUES_URL: 'https://github.com/example/huddle/issues',
      NEXT_PUBLIC_WINDOWS_CONTROL_AGENT_UPDATE_PUBLIC_KEY: 'A'.repeat(44),
    });
    expect(config.controlAgentRelease).toBeNull();
    expect(config.windowsControlAgentRelease?.channelUrl).toBe('https://example.com/windows');
  });
});
