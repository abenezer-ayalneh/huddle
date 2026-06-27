/**
 * Format a millisecond duration as `m:ss`, or `h:mm:ss` once it passes an hour.
 *
 * Floors to whole seconds: intended for live ticking timers (the call timer, the
 * recording indicator) where a partial trailing second should not round up. The
 * minutes field is zero-padded only when an hours field is present.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
