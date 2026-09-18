import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLaunchDialog from './AgentLaunchDialog';

vi.mock('@/lib/api', () => ({ API_URL: 'https://huddle.example.test' }));

const bootstrap = { room: 'design-review', sessionId: 'session-123', code: 'bootstrap-code', expiresAt: '2026-09-02T10:02:00.000Z' };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.useRealTimers();
});

describe('AgentLaunchDialog recovery', () => {
  it('does not spend the one-time link until the Sharer explicitly opens the agent and never infers a failed handoff', async () => {
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={vi.fn()} onDismiss={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /open agent/i }));
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('code=bootstrap-code');

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('launches the freshly rotated link when retrying', async () => {
    const fresh = { ...bootstrap, code: 'fresh-bootstrap-code' };
    const onReopen = vi.fn().mockResolvedValue(fresh);
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={onReopen} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open agent/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    });

    expect(onReopen).toHaveBeenCalledTimes(1);
    expect(
      document
        .querySelectorAll('iframe')
        .item(document.querySelectorAll('iframe').length - 1)
        .getAttribute('src'),
    ).toContain('code=fresh-bootstrap-code');
  });
});
