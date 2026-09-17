const DING_DURATION_S = 0.2;

/** Play a short, best-effort in-call notification tone. */
export function playCallDing(): void {
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + DING_DURATION_S);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + DING_DURATION_S);
    osc.onended = () => void ctx?.close();
    void ctx.resume().catch(() => void ctx?.close());
  } catch {
    void ctx?.close();
    // Audio blocked or unavailable — the call continues without the cue.
  }
}
