'use client';
import { useCallNoticeState } from '@/lib/systemNotices';

import {
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
  type ReceivedChatMessage,
  type TrackReferenceOrPlaceholder,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Circle,
  MessageSquare,
  Mic,
  MicOff,
  MonitorPlay,
  MoreHorizontal,
  PhoneOff,
  Send,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { isControlAgentParticipant } from '@/lib/controlProtocol';
import { orderPictureInPictureTracks, selectPictureInPictureLayout } from './pictureInPictureLayout';
import type { PresentationDisplaySurface } from './pictureInPicture.types';
import VideoTile from './VideoTile';

type PipPresentationMode = 'people' | 'presentation';

export default function PictureInPictureSurface({
  roomCode,
  localName,
  pinnedIdentity,
  iAmPresenting,
  presentationDisplaySurface,
  recordingActive,
  recordingNotice,
  hostWaitingCount,
  presentationNotice,
  remoteControlActive,
  remoteControlRole,
  remoteControlNotice,
  messages,
  onSend,
  isSending,
  unreadChat,
  chatDraft,
  onChatDraftChange,
  onChatVisibilityChange,
  onReturnToCall,
  onConfirmLeave,
}: {
  roomCode: string;
  localName: string;
  pinnedIdentity: string | null;
  iAmPresenting: boolean;
  presentationDisplaySurface: PresentationDisplaySurface | null;
  recordingActive: boolean;
  recordingNotice?: string | null;
  hostWaitingCount: number;
  presentationNotice?: string | null;
  remoteControlActive: boolean;
  remoteControlRole?: 'sharer' | 'controller' | 'participant';
  remoteControlNotice?: string | null;
  messages: ReceivedChatMessage[];
  onSend: (text: string) => Promise<unknown>;
  isSending: boolean;
  unreadChat: number;
  chatDraft: string;
  onChatDraftChange: (draft: string) => void;
  onChatVisibilityChange: (open: boolean) => void;
  onReturnToCall: () => void;
  onConfirmLeave: () => void;
}) {
  const { maintenance } = useCallNoticeState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const speaking = useSpeakingParticipants();
  const activeIdentity = speaking[0]?.identity;
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const [size, setSize] = useState({ width: 360, height: 520 });
  const [moreOpen, setMoreOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [presentationMode, setPresentationMode] = useState<PipPresentationMode>(iAmPresenting ? 'people' : 'presentation');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    onChatVisibilityChange(chatOpen);
    if (chatOpen && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chatOpen, messages, onChatVisibilityChange]);

  const cameraTracks = useMemo(() => tracks.filter((track) => track.source === Track.Source.Camera && !isControlAgentParticipant(track.participant)), [tracks]);
  const screenTrack = useMemo(
    () => tracks.find((track) => track.source === Track.Source.ScreenShare && !isControlAgentParticipant(track.participant)) ?? null,
    [tracks],
  );
  const remoteControlTrack = useMemo(
    () => tracks.find((track) => track.source === Track.Source.ScreenShare && isControlAgentParticipant(track.participant)) ?? null,
    [tracks],
  );
  const presentationTrack = remoteControlActive ? remoteControlTrack : screenTrack;
  const humanTracks = useMemo(
    () => orderPictureInPictureTracks(cameraTracks, { pinnedIdentity, activeIdentity, max: 4 }),
    [activeIdentity, cameraTracks, pinnedIdentity],
  );
  const layout = selectPictureInPictureLayout(size.width, size.height, humanTracks.tracks.length);
  const reactionCount = Math.min(3, humanTracks.tracks.length);
  const hiddenParticipantCount = Math.max(0, humanTracks.tracks.length - 1) + humanTracks.omittedCount;
  const hasPresentation = !!presentationTrack && !(remoteControlRole === 'sharer' && remoteControlActive);
  const isReadOnlyPresentation = remoteControlActive && remoteControlRole !== 'sharer';
  const effectiveMode: PipPresentationMode = hasPresentation ? presentationMode : 'people';

  useEffect(() => {
    // A new presentation is a new compact surface context; reset to the
    // privacy-first default for the Presenter and content-first default for
    // everyone else.
    if (hasPresentation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPresentationMode(iAmPresenting ? 'people' : 'presentation');
    }
  }, [hasPresentation, iAmPresenting]);

  const toggleDevice = async (device: 'microphone' | 'camera') => {
    setDeviceError(null);
    try {
      if (device === 'microphone') await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      else await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      setDeviceError(`${device === 'microphone' ? 'Microphone' : 'Camera'} access needs attention. Return to call to fix.`);
    }
  };

  const submit = async () => {
    const text = chatDraft.trim();
    if (!text || isSending) return;
    onChatDraftChange('');
    try {
      await onSend(text);
    } catch {
      onChatDraftChange(text);
    }
  };

  const showChat = (open: boolean) => {
    setChatOpen(open);
    setMoreOpen(false);
  };

  return (
    <div className="signal-call-pip-content" aria-label="Huddle picture-in-picture">
      <header className="signal-call-pip-header">
        <div className="signal-call-pip-brand">
          <span className="signal-call-pip-mark" aria-hidden="true">
            H
          </span>
          <span>Huddle</span>
          <code>{roomCode}</code>
        </div>
        <div className="signal-call-pip-header-status" aria-label="Call status">
          {humanTracks.omittedCount > 0 && <span title={`${humanTracks.omittedCount} more participants`}>+{humanTracks.omittedCount}</span>}
          {hostWaitingCount > 0 && <span title={`${hostWaitingCount} waiting`}>⏳ {hostWaitingCount}</span>}
          {recordingActive && (
            <span className="signal-call-pip-status-recording" title="Recording active">
              <Circle aria-hidden="true" /> REC
            </span>
          )}
          {hasPresentation && <span title="Presentation active">Presenting</span>}
          {unreadChat > 0 && (
            <span className="signal-call-pip-status-unread" title={`${unreadChat} unread chat messages`}>
              {unreadChat}
            </span>
          )}
        </div>
      </header>

      {(maintenance || presentationNotice || recordingNotice || remoteControlNotice || deviceError) && (
        <button type="button" className="signal-call-pip-notice" onClick={onReturnToCall}>
          <span>{maintenance ?? deviceError ?? remoteControlNotice ?? recordingNotice ?? presentationNotice}</span>
          <ArrowLeft aria-hidden="true" />
        </button>
      )}

      <main className={`signal-call-pip-main signal-call-pip-layout-${layout}`} data-display-surface={presentationDisplaySurface ?? undefined}>
        {chatOpen ? (
          <ChatDrawer
            listRef={listRef}
            messages={messages}
            draft={chatDraft}
            onDraftChange={onChatDraftChange}
            onSubmit={() => void submit()}
            isSending={isSending}
            onClose={() => showChat(false)}
          />
        ) : (
          <>
            {hasPresentation && effectiveMode === 'presentation' ? (
              <div className="signal-call-pip-presentation-layout">
                <PipMediaTile
                  trackRef={presentationTrack}
                  label={isReadOnlyPresentation ? 'Selected display · read-only' : 'Presenting'}
                  primary
                  protectedSurface={remoteControlRole === 'sharer' && remoteControlActive}
                />
                <div className={`signal-call-pip-reactions signal-call-pip-reactions-${reactionCount}`} aria-label="Participant reactions">
                  {humanTracks.tracks.slice(0, 3).map((track) => (
                    <PipMediaTile
                      key={`${track.participant.identity}-${track.source}`}
                      trackRef={track}
                      compact
                      fallbackName={track.participant.isLocal ? localName : undefined}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className={`signal-call-pip-people signal-call-pip-people-${layout}`} data-participant-count={humanTracks.tracks.length}>
                {humanTracks.tracks.map((track, index) => (
                  <PipMediaTile
                    key={`${track.participant.identity}-${track.source}`}
                    trackRef={track}
                    active={track.participant.identity === activeIdentity && humanTracks.tracks.length > 1}
                    primary={layout === 'primary' && index === 0}
                    fallbackName={track.participant.isLocal ? localName : undefined}
                  />
                ))}
                {humanTracks.tracks.length === 0 && <EmptyPeopleState />}
                {layout === 'primary' && hiddenParticipantCount > 0 && (
                  <span className="signal-call-pip-participant-count">+{hiddenParticipantCount} more</span>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {moreOpen && (
        <div className="signal-call-pip-more" role="menu" aria-label="More picture-in-picture options">
          <button type="button" role="menuitem" onClick={onReturnToCall}>
            <ArrowLeft aria-hidden="true" /> Return to call
          </button>
          {hasPresentation && (
            <>
              <span className="signal-call-pip-menu-label">During Present</span>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={effectiveMode === 'people'}
                onClick={() => {
                  setPresentationMode('people');
                  setMoreOpen(false);
                }}
              >
                <Users aria-hidden="true" /> People
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={effectiveMode === 'presentation'}
                onClick={() => {
                  setPresentationMode('presentation');
                  setMoreOpen(false);
                }}
              >
                <MonitorPlay aria-hidden="true" /> Presentation
              </button>
            </>
          )}
        </div>
      )}

      {leaveConfirm && (
        <div className="signal-call-pip-confirm" role="dialog" aria-label="Leave call confirmation">
          <strong>Leave this call?</strong>
          <span>You will disconnect from {roomCode}.</span>
          <div>
            <button type="button" onClick={() => setLeaveConfirm(false)}>
              Stay
            </button>
            <button type="button" className="signal-call-pip-leave-confirm" onClick={onConfirmLeave}>
              Leave
            </button>
          </div>
        </div>
      )}

      <footer className="signal-call-pip-controls" aria-label="Call controls">
        <PipControlButton
          icon={isMicrophoneEnabled ? Mic : MicOff}
          label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
          onClick={() => void toggleDevice('microphone')}
          active={isMicrophoneEnabled}
        />
        <PipControlButton
          icon={isCameraEnabled ? Camera : CameraOff}
          label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          onClick={() => void toggleDevice('camera')}
          active={isCameraEnabled}
        />
        <PipControlButton
          icon={MessageSquare}
          label={chatOpen ? 'Hide chat' : 'Show chat'}
          onClick={() => showChat(!chatOpen)}
          badge={unreadChat}
          active={chatOpen}
        />
        <PipControlButton icon={MoreHorizontal} label="More controls" onClick={() => setMoreOpen((open) => !open)} active={moreOpen} />
        <PipControlButton
          icon={PhoneOff}
          label="Leave call"
          onClick={() => {
            setMoreOpen(false);
            setLeaveConfirm(true);
          }}
          danger
        />
      </footer>
    </div>
  );
}

function PipMediaTile({
  trackRef,
  active = false,
  primary = false,
  compact = false,
  label,
  fallbackName,
  protectedSurface = false,
}: {
  trackRef: TrackReferenceOrPlaceholder | null;
  active?: boolean;
  primary?: boolean;
  compact?: boolean;
  label?: string;
  fallbackName?: string;
  protectedSurface?: boolean;
}) {
  if (!trackRef) return <EmptyPeopleState />;
  if (protectedSurface) {
    return (
      <div className={`signal-call-pip-media signal-call-pip-protected ${primary ? 'signal-call-pip-primary' : ''}`} role="status">
        <MonitorPlay aria-hidden="true" />
        <span>Your selected display is shared safely</span>
      </div>
    );
  }
  if (trackRef.source === Track.Source.Camera) {
    return (
      <div
        className={`signal-call-pip-media signal-call-pip-camera ${primary ? 'signal-call-pip-primary' : ''} ${compact ? 'signal-call-pip-compact' : ''} ${active ? 'signal-call-pip-active' : ''}`}
      >
        <VideoTile trackRef={trackRef} active={active} fallbackName={fallbackName} />
      </div>
    );
  }
  if (!isTrackReference(trackRef)) return <VideoTile trackRef={trackRef} active={active} fallbackName={fallbackName} />;
  return (
    <div
      className={`signal-call-pip-media ${primary ? 'signal-call-pip-primary' : ''} ${compact ? 'signal-call-pip-compact' : ''} ${active ? 'signal-call-pip-active' : ''}`}
    >
      <VideoTrack trackRef={trackRef} className="h-full w-full object-contain" />
      <span className="signal-call-pip-media-label">
        {label ?? (trackRef.participant.name || fallbackName || trackRef.participant.identity || 'Participant')}
        {trackRef.participant.isLocal ? ' (You)' : ''}
      </span>
    </div>
  );
}

function EmptyPeopleState() {
  return <div className="signal-call-pip-empty">Waiting for participants</div>;
}

function ChatDrawer({
  listRef,
  messages,
  draft,
  onDraftChange,
  onSubmit,
  isSending,
  onClose,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  messages: ReceivedChatMessage[];
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  isSending: boolean;
  onClose: () => void;
}) {
  return (
    <section className="signal-call-pip-chat" aria-label="Chat">
      <header>
        <strong>Chat</strong>
        <button type="button" aria-label="Hide chat" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <div ref={listRef} className="signal-call-pip-chat-list">
        {messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <article key={`${message.timestamp}-${message.from?.identity ?? ''}`}>
              <small>
                {message.from?.isLocal ? 'You' : message.from?.name || message.from?.identity || 'Participant'} ·{' '}
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </small>
              <span>{message.message}</span>
            </article>
          ))
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Type a message…" aria-label="Chat message" />
        <button type="submit" aria-label="Send message" disabled={!draft.trim() || isSending}>
          <Send aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}

function PipControlButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  danger = false,
  badge = 0,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      className={`signal-call-pip-control ${active ? 'signal-call-pip-control-active' : ''} ${danger ? 'signal-call-pip-control-danger' : ''}`}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      {badge > 0 && <span className="signal-call-pip-control-badge">{badge}</span>}
    </button>
  );
}
