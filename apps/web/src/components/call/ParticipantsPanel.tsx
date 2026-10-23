'use client';

import { useParticipantInfo, useParticipants } from '@livekit/components-react';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { isControlAgentParticipant } from '@/lib/controlProtocol';
import { useDismissOnOutside } from './useDismissOnOutside';

/** The media-room roster only: no Waiting Room or Host capabilities. */
export default function ParticipantsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useParticipants().filter((participant) => !isControlAgentParticipant(participant));
  const panelRef = useRef<HTMLElement>(null);
  useDismissOnOutside(panelRef, open, onClose, { ignoreSelector: '[data-participants-toggle]' });
  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      aria-label="Participants"
      className="signal-call-side-panel signal-call-participants-panel absolute inset-y-0 right-0 z-30 flex w-80 max-w-[85vw] flex-col border-l"
    >
      <header className="signal-call-side-panel-header flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-display text-base">Participants ({participants.length})</h2>
        <button type="button" aria-label="Hide participants" onClick={onClose} className="rounded-md p-1">
          <X className="h-5 w-5" />
        </button>
      </header>
      <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
        {participants.map((participant) => (
          <li key={participant.identity} className="break-words">
            <ParticipantName participant={participant} local={participant.isLocal} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ParticipantName({ participant, local }: { participant: ReturnType<typeof useParticipants>[number]; local: boolean }) {
  const { name } = useParticipantInfo({ participant });
  return (
    <>
      {name || participant.identity || 'Participant'}
      {local ? ' (You)' : ''}
    </>
  );
}
