import { useEffect, useState } from 'react';

// The Mute Reminder (docs/adr/0012). LiveKit mute disables the published track,
// which emits silence — so to notice speech-while-muted we open a *separate*
// analyser-only mic stream and run it for as long as the participant is muted.
// The OS mic-in-use light stays on while muted; that's the accepted tradeoff.

const SUSTAIN_MS = 500; // speech must hold this long → ignores typing/coughs/clicks
const SHOW_MS = 4000; // how long the bubble stays up
const COOLDOWN_MS = 12_000; // quiet window after a reminder before it can re-fire
const RMS_THRESHOLD = 0.045; // ~speaking volume; below this is room noise

// Best-effort guard so we never trigger a permission prompt while someone is
// muted. If the Permissions API can't answer (Firefox lacks 'microphone'), fall
// through and let getUserMedia decide — the user almost always granted at join.
async function micGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted';
  } catch {
    return true;
  }
}

/**
 * Returns whether to show the "you're talking while muted" bubble.
 * @param muted   whether the local mic is currently off (any reason)
 * @param deviceId the active audio input, so we listen to the chosen mic
 */
export function useMuteReminder(muted: boolean, deviceId?: string): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // When unmuted there's nothing to detect; the previous run's cleanup has
    // already hidden any visible bubble, so we just stay idle.
    if (!muted) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let speechStart = 0; // when the current run of speech began (0 = silent)
    let cooldownUntil = 0; // no reminder before this timestamp

    async function start() {
      if (!(await micGranted()) || cancelled) return;
      // A real device id constrains to the chosen mic; 'default'/empty means
      // "let the browser pick" — exact-matching those can fail on some browsers.
      const realDevice = deviceId && deviceId !== 'default' && deviceId !== '';
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: realDevice ? { deviceId: { exact: deviceId } } : true,
        });
      } catch {
        return; // no device / revoked → silently inactive
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      ctx = new AudioContext();
      void ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      // Source → analyser only; never connect to the destination (that would
      // echo the muted mic back to the user).
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        const now = performance.now();

        if (rms > RMS_THRESHOLD) {
          if (speechStart === 0) speechStart = now;
          if (now - speechStart >= SUSTAIN_MS && now >= cooldownUntil) {
            setShow(true);
            cooldownUntil = now + SHOW_MS + COOLDOWN_MS;
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setShow(false), SHOW_MS);
          }
        } else {
          speechStart = 0;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(hideTimer);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setShow(false);
    };
  }, [muted, deviceId]);

  return show;
}
