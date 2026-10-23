import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ParticipantsPanel from './ParticipantsPanel';

vi.mock('./useParticipantMedia', () => ({ useParticipantMedia: () => ({ micOn: false }) }));

vi.mock('@livekit/components-react', () => ({
  useParticipantInfo: ({ participant }: { participant: { name?: string } }) => ({ name: participant.name }),
  useParticipants: () => [
    { identity: 'local', name: 'Alex', isLocal: true },
    { identity: 'guest', name: 'Sam' },
    { identity: 'agent', name: 'Companion', metadata: JSON.stringify({ role: 'control-agent' }) },
  ],
}));

afterEach(cleanup);
describe('ParticipantsPanel', () => {
  it('lists people without exposing Host controls or the companion', () => {
    render(<ParticipantsPanel open onClose={() => {}} />);
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.getByText('(You)')).toBeTruthy();
    expect(screen.getAllByText('Microphone off')).toHaveLength(2);
    expect(screen.queryByText('Companion')).toBeNull();
    expect(screen.queryByRole('button', { name: /remove|admit|mute/i })).toBeNull();
  });
});
