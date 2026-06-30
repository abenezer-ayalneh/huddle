'use client';

import { useMediaDeviceSelect } from '@livekit/components-react';
import { Check, ChevronUp, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { saveDevicePreference, type PreferenceKind } from '@/lib/devicePreferences';
import DeviceAlertBadge from './DeviceAlertBadge';

// A device picker section (one kind of device with its display label), used by
// DeviceMenuContent.
export type DeviceSection = { kind: PreferenceKind; label: string };

// Merged control button: a main icon button (left) joined to a chevron menu
// trigger (right) by a separator, so a control and its menu read as one wide
// button. Left click runs the primary action; the chevron opens the popover.
// Mobile h-8, desktop sm:h-11 — noticeably smaller on small screens.

// Shared tone, so the merged button matches ControlButton's states.
function toneFor(active: boolean, danger: boolean) {
  return danger
    ? 'bg-magenta/15 text-magenta ring-1 ring-magenta/40 hover:bg-magenta/25'
    : active
      ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/40 hover:bg-cyan/25'
      : 'bg-white/8 text-white/80 ring-1 ring-white/10 hover:bg-white/15';
}

export default function MergedControlButton({
  icon: Icon,
  label,
  menuLabel,
  active = false,
  danger = false,
  disabled = false,
  alert = false,
  onClick,
  menu,
}: {
  icon: LucideIcon;
  label: string;
  menuLabel: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  // Device Recovery (docs/adr/0023): the button's device can't be accessed.
  // Collapse to a single badged button — no Switch Device chevron — whose press
  // opens the recovery dialog instead of toggling.
  alert?: boolean;
  onClick?: () => void;
  // Popover body for the chevron side. Receives a close() it can call after a
  // pick so the menu dismisses itself.
  menu: (close: () => void) => ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = toneFor(active, danger);

  if (alert) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 sm:h-11 sm:w-11 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 ${toneFor(false, true)}`}
      >
        <Icon />
        <DeviceAlertBadge />
      </button>
    );
  }

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <div className="flex items-center">
        {/* Left: the primary control. */}
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={`relative flex h-8 w-8 items-center justify-center rounded-l-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-35 sm:h-11 sm:w-11 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 ${tone}`}
        >
          <Icon />
        </button>

        {/* Separator. */}
        <div className="h-6 w-px bg-white/15 sm:h-7" />

        {/* Right: the chevron menu trigger. */}
        <PopoverTrigger
          title={menuLabel}
          aria-label={menuLabel}
          className={`relative flex h-8 w-6 items-center justify-center rounded-r-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 sm:h-11 sm:w-7 [&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4 ${tone}`}
        >
          <ChevronUp />
        </PopoverTrigger>
      </div>
      {menu(() => setMenuOpen(false))}
    </Popover>
  );
}

// Device-picker body for the chevron (Switch Device, see CONTEXT.md). The
// caller wraps it in a MergedControlButton's `menu` render.
export function DeviceMenuContent({ sections, onPick, close }: { sections: DeviceSection[]; onPick: (kind: PreferenceKind) => void; close: () => void }) {
  return (
    <PopoverContent side="top" sideOffset={14} className="glass-strong w-64 gap-1 rounded-xl p-1.5">
      {sections.map((s) => (
        <DeviceList
          key={s.kind}
          kind={s.kind}
          label={s.label}
          onPicked={(kind) => {
            close();
            onPick(kind);
          }}
        />
      ))}
    </PopoverContent>
  );
}

// Rendered only while the popover is open, so device enumeration (and any
// permission request it needs for labels) doesn't run until the user asks.
function DeviceList({ kind, label, onPicked }: { kind: PreferenceKind; label: string; onPicked: (kind: PreferenceKind) => void }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: true });

  const pick = async (deviceId: string) => {
    try {
      await setActiveMediaDevice(deviceId);
      saveDevicePreference(kind, deviceId);
    } catch {
      // device vanished between enumeration and pick — fall through; the track
      // still turns on with whatever device the browser falls back to
    } finally {
      onPicked(kind);
    }
  };

  return (
    <div>
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      {devices.length === 0 ? (
        <p className="px-2.5 pb-1.5 text-sm text-white/40">No {label.toLowerCase()} found</p>
      ) : (
        devices.map((d, i) => {
          const active = d.deviceId === activeDeviceId;
          return (
            <button
              key={d.deviceId}
              type="button"
              onClick={() => void pick(d.deviceId)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
            >
              <Check className={`h-4 w-4 shrink-0 ${active ? 'text-cyan' : 'opacity-0'}`} />
              <span className="truncate">{d.label || `${label} ${i + 1}`}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
