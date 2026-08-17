import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingThemeProvider from '@/components/landing/LandingThemeProvider';
import CallTimer from './CallTimer';

const { useRoomInfoMock } = vi.hoisted(() => ({ useRoomInfoMock: vi.fn() }));

vi.mock('@livekit/components-react', () => ({
  useRoomInfo: useRoomInfoMock,
}));

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.theme = 'light';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  useRoomInfoMock.mockReturnValue({ metadata: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CallTimer theme control', () => {
  it('keeps the saved theme toggle available before room metadata arrives without rendering a room-code rail', () => {
    render(
      <LandingThemeProvider>
        <CallTimer />
      </LandingThemeProvider>,
    );

    expect(screen.queryByText('Room')).toBeNull();
    expect(screen.queryByText('signal-handoff')).toBeNull();

    const themeButton = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(themeButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(themeButton);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('huddle-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('removes the top utility rail while the Host drawer exposes its replacement control', () => {
    render(
      <LandingThemeProvider>
        <CallTimer hidden />
      </LandingThemeProvider>,
    );

    expect(screen.queryByRole('button', { name: /switch to .* theme/i })).toBeNull();
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('renders a compact duration-only chip for the Host lane', () => {
    useRoomInfoMock.mockReturnValue({ metadata: JSON.stringify({ startedAt: Date.now() - 65_000 }) });

    render(
      <LandingThemeProvider>
        <CallTimer showThemeToggle={false} />
      </LandingThemeProvider>,
    );

    expect(screen.getByRole('timer', { name: 'Call duration 1:05' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /switch to .* theme/i })).toBeNull();
  });
});
