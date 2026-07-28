import { LivekitService } from './livekit.service';

describe('LivekitService participant account binding', () => {
  it('creates a non-reversible proof that only matches the owning account', () => {
    const config = {
      get: (name: string) =>
        ({
          LIVEKIT_API_KEY: 'key',
          LIVEKIT_API_SECRET: 'livekit-secret',
          LIVEKIT_URL: 'ws://livekit.example.test',
          PARTICIPANT_ACCOUNT_BINDING_SECRET: 'binding-secret',
        })[name],
    };
    const livekit = new LivekitService(config as never);
    const proof = livekit.accountBindingFor('user-ada');

    expect(proof).not.toContain('user-ada');
    expect(livekit.matchesAccountBinding('user-ada', proof)).toBe(true);
    expect(livekit.matchesAccountBinding('user-bo', proof)).toBe(false);
  });
});
