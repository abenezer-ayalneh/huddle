'use client';

import { useTrackToggle } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorOff, MessageSquare, MousePointer2, PhoneOff, ChevronUp, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DeviceMenu, { type DeviceSection } from './DeviceMenu';

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
}) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });

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
        <div className="flex items-center gap-0.5">
          <ControlButton
            icon={mic.enabled ? Mic : MicOff}
            label={mic.enabled ? 'Mute microphone' : 'Unmute microphone'}
            active={mic.enabled}
            danger={!mic.enabled}
            disabled={mic.pending}
            onClick={() => mic.toggle()}
          />
          <DeviceMenu label="Switch microphone or speaker" sections={micSections} onPick={(kind) => kind === 'audioinput' && ensureOn(mic)} />
        </div>
        <div className="flex items-center gap-0.5">
          <ControlButton
            icon={cam.enabled ? Video : VideoOff}
            label={cam.enabled ? 'Turn camera off' : 'Turn camera on'}
            active={cam.enabled}
            danger={!cam.enabled}
            disabled={cam.pending}
            onClick={() => cam.toggle()}
          />
          <DeviceMenu label="Switch camera" sections={[{ kind: 'videoinput', label: 'Camera' }]} onPick={() => ensureOn(cam)} />
        </div>

        <span className="mx-1 h-7 w-px bg-white/10" />

        <div className="flex items-center gap-0.5">
          <ControlButton
            icon={iAmPresenting ? MonitorOff : MonitorUp}
            label={shareLabel}
            active={iAmPresenting}
            disabled={hasOutgoingRequest}
            onClick={onShareClick}
          />
          {onPresentWithControl && !iAmPresenting && !someoneElsePresenting && (
            <ShareMenu onPresent={onShareClick} onPresentWithControl={onPresentWithControl} />
          )}
        </div>
        <ControlButton icon={MessageSquare} label={chatOpen ? 'Hide chat' : 'Show chat'} active={chatOpen} badge={unreadChat} onClick={onToggleChat} />

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
function ShareMenu({ onPresent }: { onPresent: () => void; onPresentWithControl: () => void }) {
  const [open, setOpen] = useState(false);

  const item = (onClick: () => void, icon: LucideIcon, title: string, hint: string, disabled = false) => {
    const Icon = icon;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(false);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="More ways to present"
        aria-label="More ways to present"
        className="flex h-8 w-5 items-center justify-center rounded-full bg-white/8 text-white/70 ring-1 ring-white/10 transition-all hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 sm:h-9 sm:w-6 [&>svg]:h-3.5 [&>svg]:w-3.5"
      >
        <ChevronUp />
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={14} className="glass-strong w-72 gap-1 rounded-xl p-1.5">
        {item(onPresent, MonitorUp, 'Present screen', 'Share a tab, window, or screen — view only')}
        {item(() => {}, MousePointer2, 'Present with control', 'Share a monitor via the desktop agent; participants can take the mouse', true)}
      </PopoverContent>
    </Popover>
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
      className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent sm:h-12 sm:w-12 ${tone} [&>svg]:h-5 [&>svg]:w-5`}
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
