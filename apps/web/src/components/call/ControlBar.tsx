'use client';

import { useRoomContext, useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Circle, Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, MessageSquare, PhoneOff, PictureInPicture2, Square, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { classifyMediaError, type FailureCause, type RecoveryDevice } from '@/lib/deviceRecovery';
import MergedControlButton, { DeviceMenuContent, type DeviceSection } from './MergedControlButton';
import DeviceRecoveryDialog, { type RecoveryTarget } from './DeviceRecoveryDialog';
import { useMediaPermissions } from './useMediaPermissions';
import { useMuteReminder } from './useMuteReminder';
import { useCallShortcuts, useModifierKeyLabel } from './useCallShortcuts';

export default function ControlBar({
  onLeave,
  chatOpen,
  onToggleChat,
  unreadChat = 0,
  iAmPresenting,
  someoneElsePresenting,
  onShareClick,
  hasOutgoingRequest,
  recordMode,
  onRecordClick,
  recordBusy = false,
  remoteControlActive = false,
  onPopOut,
  pipActive = false,
}: {
  onLeave: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  unreadChat?: number;
  iAmPresenting: boolean;
  someoneElsePresenting: boolean;
  onShareClick: () => void;
  hasOutgoingRequest: boolean;
  // Request to Record (docs/adr/0011): the non-host's record affordance. The
  // host records from the Host panel instead, so this is hidden (mode
  // undefined) for the host and when someone else is already recording.
  recordMode?: 'request' | 'pending' | 'recording';
  onRecordClick?: () => void;
  recordBusy?: boolean;
  remoteControlActive?: boolean;
  // Picture-in-Picture (CONTEXT.md): pop the main stage into the OS-level
  // floating window so a Background Call stays visible. undefined hides the
  // control where PiP is unsupported.
  onPopOut?: () => void;
  pipActive?: boolean;
}) {
  // Device Recovery (docs/adr/0023): classify a failed mic/camera toggle so a
  // badge + recovery dialog can explain a blocked / busy / missing device. A
  // failed toggle today does nothing visible; this makes it actionable.
  const [micFailure, setMicFailure] = useState<FailureCause | null>(null);
  const [camFailure, setCamFailure] = useState<FailureCause | null>(null);
  const [recovery, setRecovery] = useState<RecoveryTarget | null>(null);

  // onChange clears the failure on a successful (re)enable — covering the busy /
  // in-use case, where the permission never changed so the listener below won't
  // fire. onDeviceError classifies a failed attempt.
  const clearFailure = (device: RecoveryDevice) => {
    if (device === 'camera') setCamFailure(null);
    else setMicFailure(null);
    setRecovery((r) => (r?.device === device ? null : r));
  };
  const mic = useTrackToggle({
    source: Track.Source.Microphone,
    onChange: (enabled) => enabled && clearFailure('microphone'),
    onDeviceError: (e) => setMicFailure(classifyMediaError(e)),
  });
  const cam = useTrackToggle({
    source: Track.Source.Camera,
    onChange: (enabled) => enabled && clearFailure('camera'),
    onDeviceError: (e) => setCamFailure(classifyMediaError(e)),
  });

  // Auto-recovery: when a permission flips back to granted (unblocked from the
  // address bar or via the popup below), clear the blocked state and — if the
  // participant had actually tried to use that device (a recorded failure, not a
  // passive proactive badge) — turn it back on. A permission that was simply
  // never granted is left off, so nothing goes live unasked.
  const permissions = useMediaPermissions((device) => {
    const hadFailure = device === 'camera' ? camFailure !== null : micFailure !== null;
    clearFailure(device);
    if (!hadFailure) return;
    if (device === 'camera') {
      if (!cam.enabled && !cam.pending) void cam.toggle(true);
    } else if (!mic.enabled && !mic.pending) {
      void mic.toggle(true);
    }
  });

  // Re-request a blocked device by calling getUserMedia from the click (a user
  // gesture), so the browser shows its own permission popup — like Google Meet,
  // instead of pointing at the address bar. On grant we release the probe stream
  // and turn the track on; on failure (no re-prompt, or re-denied) we fall back
  // to the recovery dialog and its manual unblock steps.
  const reRequest = async (device: RecoveryDevice) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(device === 'camera' ? { video: true } : { audio: true });
      stream.getTracks().forEach((t) => t.stop());
      clearFailure(device);
      if (device === 'camera') {
        if (!cam.enabled && !cam.pending) void cam.toggle(true);
      } else if (!mic.enabled && !mic.pending) {
        void mic.toggle(true);
      }
    } catch (e) {
      setRecovery({ device, cause: classifyMediaError(e) });
    }
  };

  // Effective cause: an observed failure, or a permission we can already see is
  // denied — so the badge shows proactively, before the participant even clicks.
  const camCause: FailureCause | null = camFailure ?? (permissions.camera === 'denied' ? 'denied' : null);
  const micCause: FailureCause | null = micFailure ?? (permissions.microphone === 'denied' ? 'denied' : null);

  // Mute Reminder (docs/adr/0012): nudge the user when they talk while muted.
  // Listens to the active mic only while muted; reads the chosen device so we
  // analyse the same input the call uses.
  const room = useRoomContext();
  const showMuteReminder = useMuteReminder(!mic.enabled, room.getActiveDevice('audioinput'));

  // Keyboard Shortcuts + Push to Talk (docs/adr/0013): Cmd/Ctrl+D and +E mirror
  // the mic/camera buttons; hold Space talks while muted. Push to talk drives
  // the mic with an explicit on/off so a quick tap still ends muted.
  const mod = useModifierKeyLabel();
  useCallShortcuts({
    onToggleAudio: () => {
      if (micCause) void reRequest('microphone');
      else if (!mic.pending) void mic.toggle();
    },
    onToggleCamera: () => {
      if (camCause) void reRequest('camera');
      else if (!cam.pending) void cam.toggle();
    },
    pushToTalk: {
      micEnabled: mic.enabled,
      micPending: mic.pending,
      setMic: (on) => void mic.toggle(on),
    },
  });

  const shareLabel = remoteControlActive
    ? 'Present is unavailable during Remote Control'
    : iAmPresenting
      ? 'Stop presenting'
      : someoneElsePresenting
        ? 'Ask to present'
        : 'Share screen';

  // Switch Device semantics: a pick always puts the device into use, so the
  // track turns on after switching (an unmute / camera-on gesture).
  const ensureOn = (t: { enabled: boolean; pending: boolean; toggle: () => Promise<unknown> }) => {
    if (!t.enabled && !t.pending) void t.toggle();
  };

  // Speaker selection needs setSinkId; hide the section where unsupported
  // (e.g. Safari). Evaluated only on the client — the popover renders nothing
  // until opened, so SSR markup is unaffected.
  const micSections: DeviceSection[] = [
    { kind: 'audioinput', label: 'Microphone' },
    ...(typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype ? [{ kind: 'audiooutput', label: 'Speaker' } as const] : []),
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:p-6">
      <div className="glass-strong pointer-events-auto flex items-center gap-2 rounded-full px-3 py-2 shadow-[0_8px_40px_oklch(0_0_0/0.5)] sm:gap-3 sm:px-4">
        <div className="relative flex items-center">
          {showMuteReminder && <MuteReminderBubble />}
          <MergedControlButton
            icon={mic.enabled ? Mic : MicOff}
            label={micCause ? 'Fix microphone access' : mic.enabled ? `Mute microphone (${mod}D)` : `Unmute microphone (${mod}D) · Hold Space to talk`}
            menuLabel="Switch microphone or speaker"
            active={mic.enabled}
            danger={!mic.enabled}
            disabled={mic.pending}
            alert={!!micCause}
            onClick={micCause ? () => void reRequest('microphone') : () => mic.toggle()}
            menu={(close) => <DeviceMenuContent sections={micSections} close={close} onPick={(kind) => kind === 'audioinput' && ensureOn(mic)} />}
          />
        </div>
        <MergedControlButton
          icon={cam.enabled ? Video : VideoOff}
          label={camCause ? 'Fix camera access' : cam.enabled ? `Turn camera off (${mod}E)` : `Turn camera on (${mod}E)`}
          menuLabel="Switch camera"
          active={cam.enabled}
          danger={!cam.enabled}
          disabled={cam.pending}
          alert={!!camCause}
          onClick={camCause ? () => void reRequest('camera') : () => cam.toggle()}
          menu={(close) => <DeviceMenuContent sections={[{ kind: 'videoinput', label: 'Camera' }]} close={close} onPick={() => ensureOn(cam)} />}
        />

        <span className="mx-1 h-7 w-px bg-white/10" />

        <ControlButton
          icon={iAmPresenting ? MonitorOff : MonitorUp}
          label={shareLabel}
          active={iAmPresenting}
          disabled={hasOutgoingRequest || remoteControlActive}
          onClick={onShareClick}
        />
        {/* display:contents wrapper carries the marker the chat panel's outside-press
            handler skips, so this toggle never closes-then-reopens chat. */}
        <span className="contents" data-chat-toggle>
          <ControlButton icon={MessageSquare} label={chatOpen ? 'Hide chat' : 'Show chat'} active={chatOpen} badge={unreadChat} onClick={onToggleChat} />
        </span>

        {onPopOut && (
          <ControlButton icon={PictureInPicture2} label={pipActive ? 'Exit picture-in-picture' : 'Pop out video'} active={pipActive} onClick={onPopOut} />
        )}

        {recordMode && onRecordClick && <RecordButton mode={recordMode} busy={recordBusy} onClick={onRecordClick} />}

        <span className="mx-1 h-7 w-px bg-white/10" />

        <ControlButton icon={PhoneOff} label="Leave call" leave onClick={onLeave} />
      </div>
      <DeviceRecoveryDialog
        target={recovery}
        permission={recovery ? permissions[recovery.device] : 'unsupported'}
        onTryAgain={() => recovery && void reRequest(recovery.device)}
        onClose={() => setRecovery(null)}
      />
    </div>
  );
}

// The non-host record affordance (docs/adr/0011). One button that walks the
// request lifecycle: ask → wait for approval → stop (approval starts it).
function RecordButton({ mode, busy, onClick }: { mode: 'request' | 'pending' | 'recording'; busy: boolean; onClick: () => void }) {
  if (mode === 'pending') {
    return (
      <button
        type="button"
        title="Waiting for the host to approve"
        aria-label="Waiting for the host to approve recording. Cancel request"
        onClick={onClick}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/70 ring-1 ring-white/10 transition-all hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 sm:h-11 sm:w-11 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5"
      >
        <LoadingSpinner aria-hidden="true" />
      </button>
    );
  }

  const recording = mode === 'recording';
  const label = recording ? 'Stop recording' : 'Request to record';
  const Icon = recording ? Square : Circle;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={recording}
      disabled={busy}
      onClick={onClick}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-35 sm:h-11 sm:w-11 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 ${
        recording ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-white/8 text-white/80 ring-1 ring-white/10 hover:bg-white/15'
      }`}
    >
      <Icon />
    </button>
  );
}

// The Mute Reminder popup (docs/adr/0012). A non-interactive bubble pointing
// down at the mic button; advisory only — the mic button below it does the
// unmuting. Anchored to the mic group's relative wrapper.
function MuteReminderBubble() {
  return (
    <div
      role="status"
      className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-1 duration-200"
    >
      <div className="glass-strong relative whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium text-white/90 shadow-[0_8px_30px_oklch(0_0_0/0.5)]">
        Trying to speak? Your mic is off
        {/* caret: a rotated square sharing the bubble's border + fill */}
        <span className="glass-strong absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]" />
      </div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  active = false,
  danger = false,
  leave = false,
  disabled = false,
  badge = 0,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  danger?: boolean;
  leave?: boolean;
  disabled?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const tone = leave
    ? 'bg-magenta text-white hover:brightness-110 neon-magenta'
    : danger
      ? 'bg-magenta/15 text-magenta ring-1 ring-magenta/40 hover:bg-magenta/25'
      : active
        ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/40 hover:bg-cyan/25'
        : 'bg-white/8 text-white/80 ring-1 ring-white/10 hover:bg-white/15';

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent sm:h-11 sm:w-11 ${tone} [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5`}
    >
      <Icon />
      {badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-magenta px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
