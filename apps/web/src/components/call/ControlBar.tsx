"use client";

import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  PhoneOff,
  type LucideIcon,
} from "lucide-react";

export default function ControlBar({
  onLeave,
  chatOpen,
  onToggleChat,
  unreadChat = 0,
  iAmPresenting,
  someoneElsePresenting,
  onShareClick,
  hasOutgoingRequest,
}: {
  onLeave: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  unreadChat?: number;
  iAmPresenting: boolean;
  someoneElsePresenting: boolean;
  onShareClick: () => void;
  hasOutgoingRequest: boolean;
}) {
  const mic = useTrackToggle({ source: Track.Source.Microphone });
  const cam = useTrackToggle({ source: Track.Source.Camera });

  const shareLabel = iAmPresenting
    ? "Stop presenting"
    : someoneElsePresenting
      ? "Ask to present"
      : "Share screen";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 sm:p-6">
      <div className="glass-strong pointer-events-auto flex items-center gap-2 rounded-full px-3 py-2 shadow-[0_8px_40px_oklch(0_0_0/0.5)] sm:gap-3 sm:px-4">
        <ControlButton
          icon={mic.enabled ? Mic : MicOff}
          label={mic.enabled ? "Mute microphone" : "Unmute microphone"}
          active={mic.enabled}
          danger={!mic.enabled}
          disabled={mic.pending}
          onClick={() => mic.toggle()}
        />
        <ControlButton
          icon={cam.enabled ? Video : VideoOff}
          label={cam.enabled ? "Turn camera off" : "Turn camera on"}
          active={cam.enabled}
          danger={!cam.enabled}
          disabled={cam.pending}
          onClick={() => cam.toggle()}
        />

        <span className="mx-1 h-7 w-px bg-white/10" />

        <ControlButton
          icon={iAmPresenting ? MonitorOff : MonitorUp}
          label={shareLabel}
          active={iAmPresenting}
          disabled={hasOutgoingRequest}
          onClick={onShareClick}
        />
        <ControlButton
          icon={MessageSquare}
          label={chatOpen ? "Hide chat" : "Show chat"}
          active={chatOpen}
          badge={unreadChat}
          onClick={onToggleChat}
        />

        <span className="mx-1 h-7 w-px bg-white/10" />

        <ControlButton
          icon={PhoneOff}
          label="Leave call"
          leave
          onClick={onLeave}
        />
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
    ? "bg-magenta text-white hover:brightness-110 neon-magenta"
    : danger
      ? "bg-magenta/15 text-magenta ring-1 ring-magenta/40 hover:bg-magenta/25"
      : active
        ? "bg-cyan/15 text-cyan ring-1 ring-cyan/40 hover:bg-cyan/25"
        : "bg-white/8 text-white/80 ring-1 ring-white/10 hover:bg-white/15";

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
