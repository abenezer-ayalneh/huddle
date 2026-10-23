'use client';

import { useParticipantInfo, useParticipants } from '@livekit/components-react';
import { Mic, MicOff, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { isControlAgentParticipant } from '@/lib/controlProtocol';
import { useParticipantMedia } from './useParticipantMedia';
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
        <h2 className="flex items-center gap-3 font-display text-lg font-semibold">
          Participants <span className="signal-roster-count">{participants.length}</span>
        </h2>
        <button
          type="button"
          aria-label="Hide participants"
          onClick={onClose}
          className="signal-roster-close flex h-10 w-10 items-center justify-center rounded-full"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <ul className="signal-roster-list min-h-0 flex-1 overflow-y-auto px-5 py-3 text-sm">
        {participants.map((participant) => (
          <li key={participant.identity} className="signal-roster-row flex items-center gap-3 py-4">
            <ParticipantRowContent participant={participant} local={participant.isLocal} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ParticipantRowContent({ participant, local }: { participant: ReturnType<typeof useParticipants>[number]; local: boolean }) {
  const { name, metadata } = useParticipantInfo({ participant });
  const { micOn } = useParticipantMedia(participant);
  const label = name || participant.identity || 'Participant';
  const words = label.trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : label.trim().slice(0, 2)).toUpperCase() || '?';
  let avatarUrl: string | undefined;
  try {
    const value = JSON.parse(metadata || '{}').avatarUrl;
    if (typeof value === 'string' && value) avatarUrl = value;
  } catch {
    /* Anonymous participants may have no metadata. */
  }
  const [failedUrl, setFailedUrl] = useState<string>();
  const StatusIcon = micOn ? Mic : MicOff;
  return (
    <>
      <span aria-hidden="true" className="signal-roster-avatar flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold">
        {avatarUrl && failedUrl !== avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- token-supplied remote avatar, matching the call tiles
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(avatarUrl)} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0 flex-1 break-words font-medium">
        {label}
        {local && <span className="signal-roster-you ml-2 text-xs font-normal">(You)</span>}
      </span>
      <span className="signal-roster-mic flex h-8 w-8 shrink-0 items-center justify-center" title={micOn ? 'Microphone on' : 'Microphone off'}>
        <StatusIcon aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">{micOn ? 'Microphone on' : 'Microphone off'}</span>
      </span>
    </>
  );
}
