'use client';

import type { LocalUserChoices } from '@livekit/components-react';
import { ChevronDown, Mic, MicOff, Moon, Sun, Video, VideoOff } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadDevicePreferences, saveDevicePreference, saveDevicePreferences } from '@/lib/devicePreferences';
import { classifyMediaError, type FailureCause, type RecoveryDevice } from '@/lib/deviceRecovery';
import LoadingSpinner from '@/components/LoadingSpinner';
import HuddleIcon from '@/components/HuddleIcon';
import LandingThemeProvider, { useLandingTheme } from '@/components/landing/LandingThemeProvider';
import DeviceAlertBadge from './DeviceAlertBadge';
import DeviceRecoveryDialog, { type RecoveryTarget } from './DeviceRecoveryDialog';
import { useMediaPermissions } from './useMediaPermissions';
import { useCallShortcuts, useModifierKeyLabel } from './useCallShortcuts';

type Defaults = {
  username?: string;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
};

type PreJoinScreenProps = {
  defaults?: Defaults;
  onSubmit: (choices: LocalUserChoices) => void;
  submitLabel: string;
  heading?: string;
  subheading?: string;
  requireName?: boolean;
  roomName?: string;
  children?: ReactNode;
};

// Custom pre-join (replaces LiveKit's <PreJoin>). The camera self-preview is a
// private workspace beside the device controls. On submit it releases the
// preview devices and returns the LocalUserChoices the call will connect with.
//
// Device Recovery (docs/adr/0023): a blocked / busy / missing camera or mic is a
// Domain Outcome, not a Fault. It is handled here in place — an alert badge on
// the affected toggle opens a recovery dialog — never escalated to onError.
export default function PreJoinScreen(props: PreJoinScreenProps) {
  return (
    <LandingThemeProvider>
      <PreJoinExperience {...props} />
    </LandingThemeProvider>
  );
}

function PreJoinExperience({
  defaults = {},
  onSubmit,
  submitLabel,
  heading = 'Ready to join?',
  subheading,
  requireName = false,
  roomName,
  children,
}: PreJoinScreenProps) {
  const [username, setUsername] = useState(defaults.username ?? '');
  const [videoEnabled, setVideoEnabled] = useState(defaults.videoEnabled ?? true);
  const [audioEnabled, setAudioEnabled] = useState(defaults.audioEnabled ?? true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Per-device failure cause (Device Recovery). Null when the device is fine.
  // Drives the alert badge and the recovery dialog's body.
  const [videoFailure, setVideoFailure] = useState<FailureCause | null>(null);
  const [audioFailure, setAudioFailure] = useState<FailureCause | null>(null);
  const [recovery, setRecovery] = useState<RecoveryTarget | null>(null);
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

  // Re-acquire the video preview for a given camera. Audio is requested only for
  // device labels (initial mount / mic recovery); here we keep it video-only.
  // Success clears the camera failure and closes its recovery dialog; failure
  // classifies the cause so the badge + dialog can explain it.
  const acquireVideo = useCallback(
    async (deviceId?: string): Promise<FailureCause | null> => {
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
        setVideoEnabled(true);
        setVideoFailure(null);
        setRecovery((r) => (r?.device === 'camera' ? null : r));
        return null;
      } catch (e) {
        const cause = classifyMediaError(e);
        setVideoEnabled(false);
        setVideoFailure(cause);
        return cause;
      }
    },
    [stopStream, attach],
  );

  // The mic has no live preview on the Device Check — we only need a grant for
  // its device labels and to verify access. Probe getUserMedia({audio}) to turn
  // it "on": success enables it and clears the failure (and refreshes labels);
  // failure classifies the cause and leaves the mic off with a badge.
  const probeMic = useCallback(async (): Promise<FailureCause | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setAudioEnabled(true);
      setAudioFailure(null);
      setRecovery((r) => (r?.device === 'microphone' ? null : r));
      await loadDevices(audioDeviceId || undefined);
      return null;
    } catch (e) {
      const cause = classifyMediaError(e);
      setAudioEnabled(false);
      setAudioFailure(cause);
      return cause;
    }
  }, [loadDevices, audioDeviceId]);

  // Re-request a blocked device by turning it on: acquireVideo / probeMic call
  // getUserMedia from the click (a user gesture), which makes the browser show
  // its own permission popup — the same move Google Meet makes, instead of
  // telling the user to hunt for the address-bar icon. On grant the device comes
  // on and its picker repopulates; on failure (the browser won't re-prompt, or it
  // was re-denied) we fall back to the recovery dialog with the manual steps.
  const reRequest = useCallback(
    async (device: RecoveryDevice) => {
      const cause = device === 'camera' ? await acquireVideo(videoDeviceId || undefined) : await probeMic();
      if (cause) setRecovery({ device, cause });
      else await loadDevices(audioDeviceId || undefined);
    },
    [acquireVideo, probeMic, videoDeviceId, audioDeviceId, loadDevices],
  );

  // Auto-recovery: when a permission flips back to granted (unblocked from the
  // address bar), repopulate the pickers and — if the participant had been trying
  // to use that device (a recorded failure, not a passive proactive badge) — turn
  // it back on. A first-time grant during a normal join records no failure, so
  // the saved Device Preference (e.g. join muted) is left intact.
  const permissions = useMediaPermissions((device) => {
    void loadDevices(audioDeviceId || undefined);
    if (device === 'camera' && videoFailure) void acquireVideo(videoDeviceId || undefined);
    else if (device === 'microphone' && audioFailure) void probeMic();
  });

  // What each device button reflects: an observed failure, or a permission we can
  // already see is denied (the proactive badge, shown on load before any click).
  const videoCause: FailureCause | null = videoFailure ?? (permissions.camera === 'denied' ? 'denied' : null);
  const audioCause: FailureCause | null = audioFailure ?? (permissions.microphone === 'denied' ? 'denied' : null);

  // Mount: load Device Preference, then take the happy path of a single combined
  // prompt (video + audio). Only on failure do we probe each device separately
  // to classify per-device — no extra prompts, since a denied device rejects
  // instantly and a granted one just succeeds.
  useEffect(() => {
    let cancelled = false;
    const prefs = loadDevicePreferences();
    const wantVideo = prefs.videoEnabled !== false;
    const wantAudio = prefs.audioEnabled !== false;
    // Defer preference hydration until after the effect's synchronous phase.
    // This keeps the mount effect focused on media acquisition and avoids a
    // cascading render during effect setup.
    queueMicrotask(() => {
      if (prefs.videoEnabled !== undefined) setVideoEnabled(prefs.videoEnabled);
      if (prefs.audioEnabled !== undefined) setAudioEnabled(prefs.audioEnabled);
    });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: wantVideo ? { deviceId: prefs.videoinput ? { ideal: prefs.videoinput } : undefined } : false,
          audio: true,
        });
        stream.getAudioTracks().forEach((t) => t.stop());
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (wantVideo) {
          attach(stream);
          const settings = stream.getVideoTracks()[0]?.getSettings();
          if (settings?.deviceId) setVideoDeviceId(settings.deviceId);
          setMirror(settings?.facingMode !== 'environment');
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
        await loadDevices(prefs.audioinput);
      } catch {
        if (cancelled) return;
        // Error path: pinpoint each device separately. No extra prompts — a
        // denied device rejects instantly, a granted one just succeeds. Badge
        // only what the participant wants on, so an off-by-choice device is quiet.
        if (wantVideo) {
          try {
            const v = await navigator.mediaDevices.getUserMedia({ video: prefs.videoinput ? { deviceId: { ideal: prefs.videoinput } } : true });
            if (cancelled) {
              v.getTracks().forEach((t) => t.stop());
            } else {
              attach(v);
              const s = v.getVideoTracks()[0]?.getSettings();
              if (s?.deviceId) setVideoDeviceId(s.deviceId);
              setMirror(s?.facingMode !== 'environment');
            }
          } catch (e) {
            if (!cancelled) {
              setVideoEnabled(false);
              setVideoFailure(classifyMediaError(e));
            }
          }
        }
        try {
          const a = await navigator.mediaDevices.getUserMedia({ audio: true });
          a.getTracks().forEach((t) => t.stop());
        } catch (e) {
          if (!cancelled && wantAudio) {
            setAudioEnabled(false);
            setAudioFailure(classifyMediaError(e));
          }
        }
        if (!cancelled) await loadDevices(prefs.audioinput);
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
      void acquireVideo(videoDeviceId || undefined);
    }
  }, [videoEnabled, stopStream, acquireVideo, videoDeviceId]);

  const toggleAudio = useCallback(() => {
    if (audioEnabled) setAudioEnabled(false);
    else void probeMic();
  }, [audioEnabled, probeMic]);

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

  // The dialog's "Try again" re-runs the same re-request (native popup) for the
  // device it's about.
  const retryRecovery = useCallback(() => {
    if (recovery) void reRequest(recovery.device);
  }, [recovery, reRequest]);

  // Keyboard Shortcuts (docs/adr/0013): Cmd/Ctrl+D / +E toggle mic & camera on
  // the Device Check too. No push-to-talk here — there is nothing to talk into
  // before joining.
  const mod = useModifierKeyLabel();
  useCallShortcuts({
    onToggleAudio: () => (audioCause ? void reRequest('microphone') : toggleAudio()),
    onToggleCamera: () => (videoCause ? void reRequest('camera') : toggleVideo()),
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
    <main className="prejoin-shell">
      <PreJoinHeader />
      <div className="prejoin-route prejoin-route-one" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="prejoin-route prejoin-route-two" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <div className="prejoin-container prejoin-layout">
        <section className="prejoin-intro" aria-labelledby="prejoin-heading">
          <p className="prejoin-kicker">Device check</p>
          <h1 id="prejoin-heading">{heading}</h1>
          {subheading && <p className="prejoin-lede">{subheading}</p>}
          <div className="prejoin-private-note">
            <span>Private preview</span>
            <p>Your camera preview stays on this device until you join the call.</p>
          </div>

          <div className="prejoin-task-panel">
            <div className="prejoin-panel-heading">
              <p>Call setup</p>
              <h2>Choose your devices.</h2>
            </div>

            <div className="prejoin-form">
              {requireName && (
                <label className="prejoin-field" htmlFor="prejoin-name">
                  <span>Your name</span>
                  <input
                    id="prejoin-name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="Your name"
                    autoFocus
                    className="prejoin-input"
                  />
                </label>
              )}

              <div className="prejoin-device-toggles" aria-label="Camera and microphone controls">
                <ToggleButton
                  on={audioEnabled}
                  onIcon={Mic}
                  offIcon={MicOff}
                  label={audioCause ? 'Allow microphone access' : `${audioEnabled ? 'Microphone on' : 'Microphone off'} (${mod}D)`}
                  name="Microphone"
                  shortcut={`${mod}D`}
                  alert={!!audioCause}
                  onClick={audioCause ? () => void reRequest('microphone') : toggleAudio}
                />
                <ToggleButton
                  on={videoEnabled}
                  onIcon={Video}
                  offIcon={VideoOff}
                  label={videoCause ? 'Allow camera access' : `${videoEnabled ? 'Camera on' : 'Camera off'} (${mod}E)`}
                  name="Camera"
                  shortcut={`${mod}E`}
                  alert={!!videoCause}
                  onClick={videoCause ? () => void reRequest('camera') : toggleVideo}
                />
              </div>

              <DeviceSelect icon={Video} value={videoDeviceId} devices={videoDevices} fallbackLabel="Camera" blocked={!!videoCause} onChange={changeCamera} />
              <DeviceSelect icon={Mic} value={audioDeviceId} devices={audioDevices} fallbackLabel="Microphone" blocked={!!audioCause} onChange={changeMic} />

              <button type="button" onClick={submit} disabled={!canJoin || submitting} className="prejoin-primary-button">
                {submitting && <LoadingSpinner className="h-4 w-4" />}
                {!submitting && submitLabel}
              </button>

              {children}
            </div>
          </div>
        </section>

        <section className="prejoin-preview-panel" aria-label="Camera preview">
          <header className="prejoin-preview-header">
            <span>Preview</span>
            {roomName && <strong>Room code: {roomName}</strong>}
          </header>
          <div className="prejoin-preview-stage">
            {videoEnabled && !videoCause ? (
              <video ref={videoRef} autoPlay playsInline muted className={`prejoin-video ${mirror ? 'prejoin-video-mirrored' : ''}`} />
            ) : (
              <div className="prejoin-preview-off">
                <VideoOff aria-hidden="true" />
                <p>{videoCause ? 'Camera access needs attention' : 'Camera is off'}</p>
              </div>
            )}
          </div>
          <p className="prejoin-preview-caption">You control when your camera and microphone go live.</p>
        </section>
      </div>

      <DeviceRecoveryDialog
        target={recovery}
        permission={recovery ? permissions[recovery.device] : 'unsupported'}
        onTryAgain={retryRecovery}
        onClose={() => setRecovery(null)}
      />
    </main>
  );
}

function PreJoinHeader() {
  const { theme, toggleTheme } = useLandingTheme();
  const ThemeIcon = theme === 'light' ? Moon : Sun;

  return (
    <header className="prejoin-header">
      <div className="prejoin-header-inner">
        <div className="prejoin-brand-shell">
          <Link href="/" aria-label="Huddle home" className="prejoin-brand">
            <HuddleIcon className="prejoin-brand-icon" aria-hidden="true" />
            <span>Huddle</span>
          </Link>
        </div>
        <div className="prejoin-header-actions">
          <button
            type="button"
            className="prejoin-theme-button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            <ThemeIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

function ToggleButton({
  on,
  onIcon: OnIcon,
  offIcon: OffIcon,
  label,
  name,
  shortcut,
  onClick,
  alert = false,
}: {
  on: boolean;
  onIcon: typeof Mic;
  offIcon: typeof Mic;
  label: string;
  name: string;
  shortcut: string;
  onClick: () => void;
  alert?: boolean;
}) {
  // A blocked device always reads as off (red), whatever the toggle state.
  const showOff = alert || !on;
  const Icon = showOff ? OffIcon : OnIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={label}
      aria-label={label}
      className={`prejoin-device-toggle ${showOff ? 'is-off' : 'is-on'} ${alert ? 'has-alert' : ''}`}
    >
      <Icon className="prejoin-device-toggle-icon" aria-hidden="true" />
      <span className="prejoin-device-toggle-copy">
        <strong>{name}</strong>
        <small>
          {showOff ? (alert ? 'Allow access' : 'Off') : 'On'} <kbd>{shortcut}</kbd>
        </small>
      </span>
      {alert && <DeviceAlertBadge />}
    </button>
  );
}

function DeviceSelect({
  icon: Icon,
  value,
  devices,
  fallbackLabel,
  blocked = false,
  onChange,
}: {
  icon: typeof Mic;
  value: string;
  devices: MediaDeviceInfo[];
  fallbackLabel: string;
  // Device Recovery: the device's permission is blocked, so there are no devices
  // to choose — disable the picker and say so.
  blocked?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className="prejoin-select-field">
      <span>{fallbackLabel}</span>
      <div className="prejoin-select-wrap">
        <Icon className="pointer-events-none prejoin-select-icon" aria-hidden="true" />
        <select
          value={blocked ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={blocked || devices.length === 0}
          aria-label={`${fallbackLabel} device`}
          className="prejoin-select"
        >
          {blocked ? (
            <option value="">Permission blocked</option>
          ) : devices.length === 0 ? (
            <option value="">{fallbackLabel} unavailable</option>
          ) : (
            devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `${fallbackLabel} ${i + 1}`}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="pointer-events-none prejoin-select-chevron" aria-hidden="true" />
      </div>
    </label>
  );
}
