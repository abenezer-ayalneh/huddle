import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RemoteControlStatus from './RemoteControlStatus';

const session = {
  sessionId: 'session-123',
  status: 'active' as const,
  sharerIdentity: 'sharer',
  sharerName: 'Ada',
  controllerIdentity: 'controller',
  controllerName: 'Bo',
  agentIdentity: 'control-agent:session-123',
  agentConnected: true,
  renewalDueAt: '2026-09-02T10:30:00.000Z',
};

afterEach(() => cleanup());

describe('RemoteControlStatus mobile safety', () => {
  it('keeps Stop available while hiding desktop-only controller clipboard actions', () => {
    render(
      <RemoteControlStatus
        session={session}
        iAmSharer={false}
        iAmController
        recordingActive={false}
        renewalRemainingMs={null}
        clipboardCopyPending
        onStop={vi.fn()}
        onRenew={vi.fn()}
        onCopyReceivedClipboard={vi.fn()}
        canUseDesktopRemoteControl={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copy received text' })).toBeNull();
  });

  it('hides the desktop-only Sharer reconfirmation action', () => {
    render(
      <RemoteControlStatus
        session={session}
        iAmSharer
        iAmController={false}
        recordingActive={false}
        renewalRemainingMs={60_000}
        clipboardCopyPending={false}
        onStop={vi.fn()}
        onRenew={vi.fn()}
        onCopyReceivedClipboard={vi.fn()}
        canUseDesktopRemoteControl={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /reconfirm/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });
});
