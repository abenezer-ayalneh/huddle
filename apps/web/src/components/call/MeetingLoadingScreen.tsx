'use client';

import LoadingSpinner from '@/components/LoadingSpinner';
import MeetingEntryShell from './MeetingEntryShell';

export type MeetingLoadingStage = 'resolving' | 'checking' | 'requesting' | 'rejoining' | 'connecting';

const stageCopy: Record<MeetingLoadingStage, { kicker: string; title: string; lede: string; status: string }> = {
  resolving: {
    kicker: 'Room resolution',
    title: 'Opening the room.',
    lede: 'We’re checking the meeting link and preparing the right way in.',
    status: 'Resolving room access',
  },
  checking: {
    kicker: 'Room resolution',
    title: 'Checking the room.',
    lede: 'We’re confirming this meeting is ready before asking for camera and microphone access.',
    status: 'Checking meeting link',
  },
  requesting: {
    kicker: 'Guest request',
    title: 'Sending your request.',
    lede: 'Your Device Check is complete. We’re sending your request to the host.',
    status: 'Requesting to join',
  },
  rejoining: {
    kicker: 'Direct rejoin',
    title: 'Rejoining your huddle.',
    lede: 'We’re refreshing your call access and getting the room ready.',
    status: 'Rejoining call',
  },
  connecting: {
    kicker: 'Call entry',
    title: 'Opening the huddle.',
    lede: 'Your entry is approved. We’re connecting your camera, microphone, and call session.',
    status: 'Connecting to call',
  },
};

export default function MeetingLoadingScreen({ room, stage = 'resolving' }: { room: string; stage?: MeetingLoadingStage }) {
  const copy = stageCopy[stage];

  return (
    <MeetingEntryShell
      room={room}
      kicker={copy.kicker}
      title={copy.title}
      lede={copy.lede}
      panelLabel="Connection status"
      headingId="meeting-loading-title"
      panelLabelId="meeting-loading-panel-label"
      ariaBusy
    >
      <div className="meeting-loading-mark" aria-hidden="true">
        <LoadingSpinner />
      </div>

      <p className="meeting-loading-status">{copy.status}</p>
    </MeetingEntryShell>
  );
}
