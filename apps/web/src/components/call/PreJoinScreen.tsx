'use client';

import type { LocalUserChoices } from '@livekit/components-react';
import { ChevronDown, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadDevicePreferences, saveDevicePreference, saveDevicePreferences, type DevicePreferences } from '@/lib/devicePreferences';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useCallShortcuts, useModifierKeyLabel } from './useCallShortcuts';

type Defaults = {
  username?: string;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
};

// Custom pre-join (replaces LiveKit's <PreJoin>). The camera self-preview fills
// the screen; a floating glass cluster holds the name field, device pickers,
// mic/cam toggles and the join button. On submit it releases the preview
// devices and returns the LocalUserChoices the call will connect with.
export default function PreJoinScreen({
  defaults = {},
  onSubmit,
  onError,
  submitLabel,
  heading = 'Ready to join?',
  subheading,
  requireName = false,
  children,
}: {
  defaults?: Defaults;
  onSubmit: (choices: LocalUserChoices) => void;
  onError?: (e: Error) => void;
  submitLabel: string;
  heading?: string;
  subheading?: string;
  requireName?: boolean;
  children?: ReactNode;
}) {
  const [username, setUsername] = useState(defaults.username ?? '');
  const [videoEnabled, setVideoEnabled] = useState(defaults.videoEnabled ?? true);
  const [audioEnabled, setAudioEnabled] = useState(defaults.audioEnabled ?? true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Mirror the preview like a bathroom mirror for a front camera, but show a
  // phone's back ("environment") camera un-flipped. Same rule as the in-call
  // Self-view (useMirrorLocalCamera): mirror unless facingMode is 'environment',
  // so desktop webcams (no facingMode) stay mirrored. See ADR-0014.
  const [mirror, setMirror] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const attach = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, []);

  const loadDevices = useCallback(async (preferredAudioId?: string) => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const audio = all.filter((d) => d.kind === 'audioinput');
      setVideoDevices(all.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(audio);
      // Default the mic to the remembered Device Preference when still
      // plugged in, else the first input, once labels are available.
      const preferred = preferredAudioId && audio.some((d) => d.deviceId === preferredAudioId) ? preferredAudioId : undefined;
      setAudioDeviceId((prev) => prev || preferred || audio[0]?.deviceId || '');
    } catch {
      /* enumeration can fail before permission; ignore */
    }
  }, []);

  // Re-acquire the video preview for a given camera. Audio is requested only
  // once (initial mount) for device labels; here we keep it video-only.
  const acquireVideo = useCallback(
    async (deviceId?: string) => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false,
        });
        attach(stream);
        const settings = stream.getVideoTracks()[0]?.getSettings();
        if (settings?.deviceId) setVideoDeviceId(settings.deviceId);
        setMirror(settings?.facingMode !== 'environment');
        setNote(null);
      } catch (e) {
        setVideoEnabled(false);
        setNote('Camera unavailable — you can still join without video.');
        onError?.(e as Error);
      }
    },
    [stopStream, attach, onError],
  );

  // Mount: request both tracks once to unlock device labels, keep video for the
  // preview, immediately release the mic (no self-monitoring here). Load Device
  // Preference (device IDs and on/off state) to pre-fill the toggles.
  useEffect(() => {
    let cancelled = false;
    const prefs = loadDevicePreferences();
    // Pre-fill on/off toggles from Device Preference if available, else use defaults.
    if (prefs.videoEnabled !== undefined) setVideoEnabled(prefs.videoEnabled);
    if (prefs.audioEnabled !== undefined) setAudioEnabled(prefs.audioEnabled);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: prefs.videoinput ? { deviceId: { ideal: prefs.videoinput } } : true,
          audio: true,
        });
        stream.getAudioTracks().forEach((t) => t.stop());
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        attach(stream);
        const settings = stream.getVideoTracks()[0]?.getSettings();
        if (settings?.deviceId) setVideoDeviceId(settings.deviceId);
        setMirror(settings?.facingMode !== 'environment');
        await loadDevices(prefs.audioinput);
      } catch (e) {
        if (cancelled) return;
        setVideoEnabled(false);
        setNote('Camera/mic unavailable — you can still join without them.');
        onError?.(e as Error);
        await loadDevices(prefs.audioinput);
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVideo = useCallback(() => {
    if (videoEnabled) {
      stopStream();
      setVideoEnabled(false);
    } else {
      setVideoEnabled(true);
      void acquireVideo(videoDeviceId || undefined);
    }
  }, [videoEnabled, stopStream, acquireVideo, videoDeviceId]);

  const changeCamera = useCallback(
    (id: string) => {
      setVideoDeviceId(id);
      saveDevicePreference('videoinput', id);
      if (videoEnabled) void acquireVideo(id);
    },
    [videoEnabled, acquireVideo],
  );

  const changeMic = useCallback((id: string) => {
    setAudioDeviceId(id);
    saveDevicePreference('audioinput', id);
  }, []);

  // Keyboard Shortcuts (docs/adr/0013): Cmd/Ctrl+D / +E toggle mic & camera on
  // the Device Check too. No push-to-talk here — there is nothing to talk into
  // before joining.
  const mod = useModifierKeyLabel();
  useCallShortcuts({
    onToggleAudio: () => setAudioEnabled((v) => !v),
    onToggleCamera: toggleVideo,
  });

  const canJoin = !requireName || username.trim().length > 0;

  const submit = useCallback(() => {
    if (!canJoin || submitting) return;
    setSubmitting(true);
    stopStream();
    // Save the on/off state to Device Preference for the next join.
    saveDevicePreferences({ audioEnabled, videoEnabled });
    onSubmit({
      username: username.trim(),
      videoEnabled,
      audioEnabled,
      videoDeviceId,
      audioDeviceId,
    });
  }, [canJoin, submitting, stopStream, onSubmit, username, videoEnabled, audioEnabled, videoDeviceId, audioDeviceId]);

  return (
    <main className="bg-dotgrid relative flex flex-1 items-center justify-center overflow-hidden">
      {/* Full-screen preview / placeholder. */}
      <div className="absolute inset-0">
        {videoEnabled ? (
          <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover opacity-90 ${mirror ? '-scale-x-100' : ''}`} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <VideoOff className="h-16 w-16 text-white/15" />
          </div>
        )}
        {/* Vignette so the floating controls stay legible over any frame. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/50" />
      </div>

      <div className="absolute left-6 top-6 z-10">
        <Brand />
      </div>

      {/* Floating control cluster. */}
      <div className="glass-strong relative z-10 m-4 w-full max-w-md rounded-2xl p-6 shadow-[0_8px_60px_oklch(0_0_0/0.6)]">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl font-semibold text-white">{heading}</h1>
          {subheading && <p className="text-sm text-white/60">{subheading}</p>}
        </div>

        <div className="mt-5 space-y-3">
          {requireName && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Your name"
              autoFocus
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-white outline-none transition-colors placeholder:text-white/40 focus:border-cyan/60 focus:ring-2 focus:ring-cyan/30"
            />
          )}

          <div className="flex items-center justify-center gap-3">
            <ToggleButton
              on={audioEnabled}
              onIcon={Mic}
              offIcon={MicOff}
              label={`${audioEnabled ? 'Mic on' : 'Mic off'} (${mod}D)`}
              onClick={() => setAudioEnabled((v) => !v)}
            />
            <ToggleButton
              on={videoEnabled}
              onIcon={Video}
              offIcon={VideoOff}
              label={`${videoEnabled ? 'Camera on' : 'Camera off'} (${mod}E)`}
              onClick={toggleVideo}
            />
          </div>

          <DeviceSelect icon={Video} value={videoDeviceId} devices={videoDevices} fallbackLabel="Camera" onChange={changeCamera} />
          <DeviceSelect icon={Mic} value={audioDeviceId} devices={audioDevices} fallbackLabel="Microphone" onChange={changeMic} />

          {note && <p className="text-xs text-magenta">{note}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={!canJoin || submitting}
            className="neon-magenta flex items-center justify-center gap-2 mt-1 w-full rounded-lg bg-magenta px-4 py-2.5 font-display font-semibold tracking-wide text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {submitting && <LoadingSpinner className="h-4 w-4" />}
            {!submitting && submitLabel}
          </button>

          {children}
        </div>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <span className="font-display text-xl font-bold tracking-[0.25em] text-white">
      HUD<span className="text-magenta text-glow-magenta">DLE</span>
    </span>
  );
}

function ToggleButton({
  on,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
  onClick,
}: {
  on: boolean;
  onIcon: typeof Mic;
  offIcon: typeof Mic;
  label: string;
  onClick: () => void;
}) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60 [&>svg]:h-5 [&>svg]:w-5 ${
        on ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/40 hover:bg-cyan/25' : 'bg-magenta/15 text-magenta ring-1 ring-magenta/40 hover:bg-magenta/25'
      }`}
    >
      <Icon />
    </button>
  );
}

function DeviceSelect({
  icon: Icon,
  value,
  devices,
  fallbackLabel,
  onChange,
}: {
  icon: typeof Mic;
  value: string;
  devices: MediaDeviceInfo[];
  fallbackLabel: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="relative flex items-center">
      <Icon className="pointer-events-none absolute left-3 h-4 w-4 text-white/50" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={devices.length === 0}
        className="w-full appearance-none rounded-lg border border-white/15 bg-white/5 py-2.5 pl-9 pr-9 text-sm text-white/90 outline-none transition-colors focus:border-cyan/60 focus:ring-2 focus:ring-cyan/30 disabled:opacity-50"
      >
        {devices.length === 0 ? (
          <option value="">{fallbackLabel} unavailable</option>
        ) : (
          devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId} className="bg-card">
              {d.label || `${fallbackLabel} ${i + 1}`}
            </option>
          ))
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-white/50" />
    </div>
  );
}
