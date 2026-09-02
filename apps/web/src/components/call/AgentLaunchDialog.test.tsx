import { act, cleanup, render, screen } from '@testing-library/react';
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
  it('shows the compact recovery popup and a new-tab downloads link after three seconds', async () => {
    const onAgentUnavailable = vi.fn();
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={vi.fn()} onAgentUnavailable={onAgentUnavailable} onDismiss={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_999);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onAgentUnavailable).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Control Agent not detected');
    expect(onAgentUnavailable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /open downloads/i }).getAttribute('target')).toBe('_blank');
  });

  it('cancels the fallback when the browser becomes hidden', async () => {
    const onAgentUnavailable = vi.fn();
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={vi.fn()} onAgentUnavailable={onAgentUnavailable} onDismiss={vi.fn()} />);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(onAgentUnavailable).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
