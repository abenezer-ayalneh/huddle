import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SharedScreenView from './SharedScreenView';

vi.mock('./VideoTile', () => ({ default: () => <div>Shared content</div> }));
const trackRef = {} as ComponentProps<typeof SharedScreenView>['trackRef'];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SharedScreenView', () => {
  it('keeps Recording visible in fullscreen and follows native exit', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null, writable: true });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: vi.fn(async function (this: HTMLElement) {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this, writable: true });
        document.dispatchEvent(new Event('fullscreenchange'));
      }),
    });
    render(<SharedScreenView trackRef={trackRef} recordingActive />);
    fireEvent.click(screen.getByRole('button', { name: 'View shared screen fullscreen' }));
    await waitFor(() => expect(screen.getByText('Recording')).toBeTruthy());
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    fireEvent(document, new Event('fullscreenchange'));
    expect(screen.queryByText('Recording')).toBeNull();
    expect(screen.getByRole('button', { name: 'View shared screen fullscreen' })).toBeTruthy();
  });

  it('keeps the shared content available when fullscreen is rejected', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: vi.fn().mockRejectedValue(new Error('Denied')) });
    render(<SharedScreenView trackRef={trackRef} />);
    fireEvent.click(screen.getByRole('button', { name: 'View shared screen fullscreen' }));
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByText('Shared content')).toBeTruthy();
  });
});
