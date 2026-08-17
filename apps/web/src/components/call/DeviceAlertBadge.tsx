// Device Recovery (docs/adr/0023). The Device Alert: a small "!" badge pinned to
// the top-right corner of a device button whose camera or microphone can't be
// accessed. Purely decorative — the button it sits on is what's clickable, and
// pressing it opens the Device Recovery dialog. The parent must be `relative`.

export default function DeviceAlertBadge() {
  return (
    <span
      aria-hidden
      className="device-alert-badge pointer-events-none absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-magenta text-[11px] font-bold leading-none text-black shadow-[0_0_8px_oklch(0_0_0/0.5)] ring-2 ring-black/30"
    >
      !
    </span>
  );
}
