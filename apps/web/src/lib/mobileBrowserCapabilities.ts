'use client';

import { useSyncExternalStore } from 'react';

type BrowserLike = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean };
  mediaDevices?: { getDisplayMedia?: unknown };
};

export type MobileBrowserCapabilities = {
  isMobileBrowser: boolean;
  canPresent: boolean;
  canUseDesktopRemoteControl: boolean;
};

const SERVER_CAPABILITIES: MobileBrowserCapabilities = {
  isMobileBrowser: false,
  canPresent: false,
  canUseDesktopRemoteControl: false,
};

const noopSubscribe = () => () => {};
let clientCapabilities: MobileBrowserCapabilities | undefined;

function currentBrowser(): BrowserLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator as Navigator & { userAgentData?: { mobile?: boolean } };
}

/**
 * Detect a mobile browser by platform, never by viewport. iPadOS can identify
 * itself as MacIntel when requesting desktop sites, so touch points are part of
 * that platform check.
 */
export function isMobileBrowser(browser: BrowserLike | undefined = currentBrowser()): boolean {
  if (!browser) return false;
  if (typeof browser.userAgentData?.mobile === 'boolean') return browser.userAgentData.mobile;

  const userAgent = browser.userAgent ?? '';
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;

  return browser.platform === 'MacIntel' && (browser.maxTouchPoints ?? 0) > 1;
}

export function getMobileBrowserCapabilities(browser: BrowserLike | undefined = currentBrowser()): MobileBrowserCapabilities {
  const mobile = isMobileBrowser(browser);
  return {
    isMobileBrowser: mobile,
    canPresent: typeof browser?.mediaDevices?.getDisplayMedia === 'function',
    canUseDesktopRemoteControl: !mobile,
  };
}

/** Client-only capability state with a stable SSR snapshot. */
export function useMobileBrowserCapabilities(): MobileBrowserCapabilities {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      clientCapabilities ??= getMobileBrowserCapabilities();
      return clientCapabilities;
    },
    () => SERVER_CAPABILITIES,
  );
}
