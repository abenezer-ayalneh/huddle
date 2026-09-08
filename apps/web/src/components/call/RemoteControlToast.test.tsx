import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RemoteControlToast from './RemoteControlToast';

afterEach(() => {
  cleanup();
});

describe('RemoteControlToast mobile safety', () => {
  it('keeps denial available while withholding desktop-only approval', () => {
    render(
      <RemoteControlToast
        incoming={{
          requestId: 'request-id',
          room: 'design-review',
          sharerIdentity: 'sharer',
          sharerName: 'Ada',
          controllerIdentity: 'controller',
          controllerName: 'Bo',
          requestedAt: '2026-09-02T10:00:00.000Z',
          expiresAt: '2026-09-02T10:00:30.000Z',
          expiresInMs: 25_000,
        }}
        outgoing={null}
        notice={null}
        recordingActive={false}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
        onDismiss={vi.fn()}
        canApprove={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Deny' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByRole('dialog').textContent).toContain('requires a desktop browser');
  });
});
