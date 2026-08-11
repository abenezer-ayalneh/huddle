import { validateEnvironment } from './validate-env';

describe('validateEnvironment', () => {
  const production = {
    NODE_ENV: 'production',
    WEB_ORIGIN: 'https://app.example.com',
    BETTER_AUTH_URL: 'https://api.example.com',
    GOOGLE_DRIVE_REDIRECT_URI: 'https://api.example.com/storage-connections/google-drive/callback',
    LIVEKIT_URL: 'ws://livekit:7880',
    LIVEKIT_PUBLIC_URL: 'wss://livekit.example.com',
  };

  it('accepts the derived production topology', () => {
    expect(validateEnvironment(production)).toEqual(production);
  });

  it('rejects missing public origins instead of using development defaults', () => {
    expect(() => validateEnvironment({ ...production, WEB_ORIGIN: undefined })).toThrow('WEB_ORIGIN');
  });
});
