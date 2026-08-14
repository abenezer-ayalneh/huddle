import { getCorsOrigins } from './cors';

describe('getCorsOrigins', () => {
  it('allows equivalent loopback origins for local HTTP development', () => {
    expect(getCorsOrigins('http://localhost:3000', 'development')).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']);
  });

  it('accepts explicit comma-separated origins', () => {
    expect(getCorsOrigins('http://localhost:3000, https://local-huddle.example.test', 'development')).toEqual([
      'http://localhost:3000',
      'https://local-huddle.example.test',
      'http://127.0.0.1:3000',
      'http://[::1]:3000',
    ]);
  });

  it('does not expand production origins', () => {
    expect(getCorsOrigins('https://app.example.com', 'production')).toEqual(['https://app.example.com']);
  });
});
