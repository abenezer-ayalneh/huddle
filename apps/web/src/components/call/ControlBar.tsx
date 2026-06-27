'use client';

import { useRoomContext, useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  Circle,
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  MousePointer2,
  PhoneOff,
  PictureInPicture2,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { PopoverContent } from '@/components/ui/popover';
import MergedControlButton, { DeviceMenuContent, type DeviceSection } from './MergedControlButton';
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
  onPresentWithControl,
  hasOutgoingRequest,
  recordMode,
  onRecordClick,
  recordBusy = false,
  suspendShortcuts = false,
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
  // Present with Control (docs/adr/0010): undefined hides the share menu —
  // the caller gates it to desktop browsers when nobody is presenting yet.
  onPresentWithControl?: () => void;
  hasOutgoingRequest: boolean;
  // Request to Record (docs/adr/0011): the non-host's record affordance. The
  // host records from the Host panel instead, so this is hidden (mode
  // undefined) for the host and when someone else is already recording.
  recordMode?: 'request' | 'pending' | 'recording';
  onRecordClick?: () => void;
  recordBusy?: boolean;
  // Keyboard Shortcuts (docs/adr/0013): true while controlling a remote machine,
  // when keystrokes belong to that machine, not the call.
  suspendShortcuts?: boolean;
  // Picture-in-Picture (CONTEXT.md): pop the main stage into the OS-level
  // floating window so a Background Call stays visible. undefined hides the
  // control where PiP is unsupported.
  onPopOut?: () => void;
  pipActive?: boolean;
}) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });

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
      if (!mic.pending) void mic.toggle();
    },
    onToggleCamera: () => {
      if (!cam.pending) void cam.toggle();
    },
    suspended: suspendShortcuts,
    pushToTalk: {
      micEnabled: mic.enabled,
      micPending: mic.pending,
      setMic: (on) => void mic.toggle(on),
    },
  });

  const shareLabel = iAmPresenting ? 'Stop presenting' : someoneElsePresenting ? 'Ask to present' : 'Share screen';

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
            label={mic.enabled ? `Mute microphone (${mod}D)` : `Unmute microphone (${mod}D) · Hold Space to talk`}
            menuLabel="Switch microphone or speaker"
            active={mic.enabled}
            danger={!mic.enabled}
            disabled={mic.pending}
            onClick={() => mic.toggle()}
            menu={(close) => <DeviceMenuContent sections={micSections} close={close} onPick={(kind) => kind === 'audioinput' && ensureOn(mic)} />}
          />
        </div>
        <MergedControlButton
          icon={cam.enabled ? Video : VideoOff}
          label={cam.enabled ? `Turn camera off (${mod}E)` : `Turn camera on (${mod}E)`}
          menuLabel="Switch camera"
          active={cam.enabled}
          danger={!cam.enabled}
          disabled={cam.pending}
          onClick={() => cam.toggle()}
          menu={(close) => <DeviceMenuContent sections={[{ kind: 'videoinput', label: 'Camera' }]} close={close} onPick={() => ensureOn(cam)} />}
        />

        <span className="mx-1 h-7 w-px bg-white/10" />

        {onPresentWithControl && !iAmPresenting && !someoneElsePresenting ? (
          <MergedControlButton
            icon={MonitorUp}
            label={shareLabel}
            menuLabel="More ways to present"
            disabled={hasOutgoingRequest}
            onClick={onShareClick}
            menu={(close) => <ShareMenuContent close={close} onPresent={onShareClick} onPresentWithControl={onPresentWithControl} />}
          />
        ) : (
          <ControlButton
            icon={iAmPresenting ? MonitorOff : MonitorUp}
            label={shareLabel}
            active={iAmPresenting}
            disabled={hasOutgoingRequest}
            onClick={onShareClick}
          />
        )}
        <ControlButton icon={MessageSquare} label={chatOpen ? 'Hide chat' : 'Show chat'} active={chatOpen} badge={unreadChat} onClick={onToggleChat} />

        {onPopOut && (
          <ControlButton icon={PictureInPicture2} label={pipActive ? 'Exit picture-in-picture' : 'Pop out video'} active={pipActive} onClick={onPopOut} />
        )}

        {recordMode && onRecordClick && <RecordButton mode={recordMode} busy={recordBusy} onClick={onRecordClick} />}

        <span className="mx-1 h-7 w-px bg-white/10" />

        <ControlButton icon={PhoneOff} label="Leave call" leave onClick={onLeave} />
      </div>
    </div>
  );
}

// Share-time choice (docs/adr/0010): plain Present (browser picker, any
// surface, never controllable) vs Present with Control (the desktop agent
// shares one whole monitor and can hand input to a participant).
// Present with Control is disabled pending the agent runtime fix
// (rust-sdks#795) and the manual two-window verification.
// Rendered as the chevron-menu body of the share MergedControlButton.
function ShareMenuContent({ onPresent, close }: { onPresent: () => void; onPresentWithControl: () => void; close: () => void }) {
  const item = (onClick: () => void, icon: LucideIcon, title: string, hint: string, disabled = false) => {
    const Icon = icon;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          close();
          onClick();
        }}
        className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-white/90">
            {title}
            {disabled && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">Coming soon</span>
            )}
          </span>
          <span className="block text-xs text-white/50">{hint}</span>
        </span>
      </button>
    );
  };

  return (
    <PopoverContent side="top" sideOffset={14} className="glass-strong w-72 gap-1 rounded-xl p-1.5">
      {item(onPresent, MonitorUp, 'Present screen', 'Share a tab, window, or screen — view only')}
      {item(() => {}, MousePointer2, 'Present with control', 'Share a monitor via the desktop agent; participants can take the mouse', true)}
    </PopoverContent>
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
        <Loader2 className="animate-spin" />
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
