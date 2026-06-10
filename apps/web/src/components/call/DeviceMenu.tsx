"use client";

import { useMediaDeviceSelect } from "@livekit/components-react";
import { Check, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { saveDevicePreference, type PreferenceKind } from "@/lib/devicePreferences";

// In-call device picker (Switch Device, see CONTEXT.md): a slim chevron
// attached to a control-bar button opens a popover of devices. Picking any
// listed device — including the one already active — switches to it, saves the
// Device Preference, and (via onPick) turns the track on: the picker doubles
// as an unmute / camera-on gesture.

export type DeviceSection = { kind: PreferenceKind; label: string };

export default function DeviceMenu({ label, sections, onPick }: { label: string; sections: DeviceSection[]; onPick: (kind: PreferenceKind) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title={label}
        aria-label={label}
        className="flex h-8 w-5 items-center justify-center rounded-full bg-white/8 text-white/70 ring-1 ring-white/10 transition-all hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 sm:h-9 sm:w-6 [&>svg]:h-3.5 [&>svg]:w-3.5"
      >
        <ChevronUp />
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={14} className="glass-strong w-64 gap-1 rounded-xl p-1.5">
        {sections.map((s) => (
          <DeviceList
            key={s.kind}
            kind={s.kind}
            label={s.label}
            onPicked={(kind) => {
              setOpen(false);
              onPick(kind);
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
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
      /* device vanished between enumeration and pick — fall through; the
         track still turns on with whatever device the browser falls back to */
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
              <Check className={`h-4 w-4 shrink-0 ${active ? "text-cyan" : "opacity-0"}`} />
              <span className="truncate">{d.label || `${label} ${i + 1}`}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
