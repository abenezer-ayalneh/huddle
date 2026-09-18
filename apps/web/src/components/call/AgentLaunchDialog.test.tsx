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
  it('does not spend the one-time link until the Sharer explicitly opens the agent', async () => {
    const onAgentUnavailable = vi.fn();
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={vi.fn()} onAgentUnavailable={onAgentUnavailable} onDismiss={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onAgentUnavailable).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /open agent/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Control Agent not detected');
    expect(onAgentUnavailable).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: /open downloads/i }).getAttribute('target')).toBe('_blank');
  });

  it('cancels the fallback when the browser becomes hidden', async () => {
    const onAgentUnavailable = vi.fn();
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={vi.fn()} onAgentUnavailable={onAgentUnavailable} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open agent/i }));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(onAgentUnavailable).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('cancels the fallback when Windows hands focus to the Control Agent', async () => {
    const onAgentUnavailable = vi.fn();
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={vi.fn()} onAgentUnavailable={onAgentUnavailable} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open agent/i }));

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(onAgentUnavailable).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('launches the freshly rotated link when retrying', async () => {
    const fresh = { ...bootstrap, code: 'fresh-bootstrap-code' };
    const onReopen = vi.fn().mockResolvedValue(fresh);
    render(<AgentLaunchDialog bootstrap={bootstrap} onReopen={onReopen} onAgentUnavailable={vi.fn()} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open agent/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    });

    expect(onReopen).toHaveBeenCalledTimes(1);
    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('code=fresh-bootstrap-code');
  });
});
