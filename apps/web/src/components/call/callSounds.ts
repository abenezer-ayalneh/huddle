const DING_DURATION_S = 0.2;
export const ROOM_JOINED_SOUND_SRC = '/sounds/room-joined.mp3';

/** Play the generated, short room-joined sound. */
export function playRoomJoinedSound(): void {
  if (typeof Audio === 'undefined') return;
  try {
    const audio = new Audio(ROOM_JOINED_SOUND_SRC);
    audio.preload = 'auto';
    audio.volume = 0.45;
    void audio.play().catch(() => {
      // Browser audio may be blocked; the call continues without the cue.
    });
  } catch {
    // Audio unavailable — the call continues without the cue.
  }
}

/** Play the existing short waiting-room notification tone. */
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
