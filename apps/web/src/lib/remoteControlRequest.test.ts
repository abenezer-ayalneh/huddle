import { describe, expect, it, vi } from 'vitest';
import { getRemoteControlRequestRemainingMs } from './remoteControlRequest';

const serverRequest = {
  requestedAt: '2026-09-02T10:00:00.000Z',
  expiresAt: '2026-09-02T10:00:30.000Z',
  expiresInMs: 25_000,
};

describe('getRemoteControlRequestRemainingMs', () => {
  it.each([new Date('2026-09-02T09:55:00.000Z'), new Date('2026-09-02T10:05:00.000Z')])(
    'uses the server-relative TTL even when the browser clock is %s',
    (browserNow) => {
      vi.useFakeTimers();
      vi.setSystemTime(browserNow);

      expect(getRemoteControlRequestRemainingMs(serverRequest)).toBe(25_000);

      vi.useRealTimers();
    },
  );

  it('uses the original server-issued lifetime while an older API rolls out', () => {
    expect(getRemoteControlRequestRemainingMs({ requestedAt: serverRequest.requestedAt, expiresAt: serverRequest.expiresAt })).toBe(30_000);
  });

  it.each([
    { ...serverRequest, expiresInMs: 0 },
    { ...serverRequest, expiresInMs: -1 },
    { ...serverRequest, expiresInMs: 30_001 },
    { ...serverRequest, expiresInMs: Number.NaN },
    { requestedAt: serverRequest.requestedAt, expiresAt: serverRequest.requestedAt },
    { requestedAt: serverRequest.requestedAt, expiresAt: 'not-a-date' },
  ])('rejects exhausted or malformed request timing', (request) => {
    expect(getRemoteControlRequestRemainingMs(request)).toBeNull();
  });
});
