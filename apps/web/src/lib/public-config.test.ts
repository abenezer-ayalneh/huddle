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

describe('Public configuration', () => {
  it('returns the operator and repository metadata needed by public pages', () => {
    expect(readPublicConfig(baseEnvironment)).toMatchObject({
      operatorName: 'Huddle',
      projectRepositoryUrl: 'https://github.com/example/huddle',
    });
  });
});
