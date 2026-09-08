import { describe, expect, it, vi } from 'vitest';
import { getMobileBrowserCapabilities, isMobileBrowser } from './mobileBrowserCapabilities';

describe('mobile browser capabilities', () => {
  it.each([
    ['iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }],
    ['Android', { userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)' }],
    ['desktop-UA iPad', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }],
  ])('recognizes %s as mobile', (_name, browser) => {
    expect(isMobileBrowser(browser)).toBe(true);
  });

  it('keeps desktop browsers eligible for desktop Remote Control', () => {
    expect(isMobileBrowser({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(getMobileBrowserCapabilities({ userAgentData: { mobile: false } }).canUseDesktopRemoteControl).toBe(true);
  });

  it('uses getDisplayMedia as the Present capability', () => {
    expect(getMobileBrowserCapabilities({ userAgent: 'Android', mediaDevices: { getDisplayMedia: vi.fn() } }).canPresent).toBe(true);
    expect(getMobileBrowserCapabilities({ userAgent: 'iPhone', mediaDevices: {} }).canPresent).toBe(false);
  });
});
