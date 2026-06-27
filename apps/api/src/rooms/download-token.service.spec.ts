import { InternalServerErrorException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DownloadTokenService } from './download-token.service';

const config = (secret: string | undefined) => ({ get: () => secret }) as unknown as ConfigService;

describe('DownloadTokenService', () => {
  it('round-trips a token bound to its exact room + recording', () => {
    const tokens = new DownloadTokenService(config('s3cret'));
    const token = tokens.sign('standup', 'rec-1');

    expect(tokens.verify('standup', 'rec-1', token)).toBe(true);
    // Bound to both room and id — neither may differ.
    expect(tokens.verify('other', 'rec-1', token)).toBe(false);
    expect(tokens.verify('standup', 'rec-2', token)).toBe(false);
  });

  it('rejects an expired token', () => {
    const tokens = new DownloadTokenService(config('s3cret'));
    jest.useFakeTimers();
    try {
      const token = tokens.sign('standup', 'rec-1');
      jest.advanceTimersByTime(5 * 60 * 1000 + 1); // past the 5-minute TTL
      expect(tokens.verify('standup', 'rec-1', token)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects a tampered signature and malformed tokens', () => {
    const tokens = new DownloadTokenService(config('s3cret'));
    const token = tokens.sign('standup', 'rec-1');
    const [exp, sig] = token.split('.');

    expect(tokens.verify('standup', 'rec-1', `${exp}.${sig}x`)).toBe(false);
    expect(tokens.verify('standup', 'rec-1', `${exp}.`)).toBe(false);
    expect(tokens.verify('standup', 'rec-1', 'not-a-token')).toBe(false);
    expect(tokens.verify('standup', 'rec-1', '')).toBe(false);
  });

  it("can't be verified by a service holding a different secret", () => {
    const minted = new DownloadTokenService(config('secret-a')).sign('standup', 'rec-1');
    const other = new DownloadTokenService(config('secret-b'));
    expect(other.verify('standup', 'rec-1', minted)).toBe(false);
  });

  it('refuses to construct without a signing secret', () => {
    expect(() => new DownloadTokenService(config(undefined))).toThrow(InternalServerErrorException);
  });
});
