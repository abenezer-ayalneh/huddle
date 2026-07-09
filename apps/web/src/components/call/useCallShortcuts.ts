import { useEffect, useRef, useSyncExternalStore } from 'react';

// Keyboard Shortcuts + Push to Talk (docs/adr/0013). A single window-level key
// handler that mirrors the control-bar mic/camera buttons and adds hold-Space
// push-to-talk. It drives the same toggles as the buttons — no new media path.
//
// Cmd/Ctrl+D (mic) and Cmd/Ctrl+E (camera) are claimed combos: ⌘D bookmarks the
// page and an extension may bind ⌘E. We win them the way Meet/Zoom do — listen
// in the *capture* phase on window (so we run before page-level extension
// listeners) and call stopImmediatePropagation + preventDefault, so the combo
// reaches neither the browser default nor any other keydown listener.

// Push to Talk needs the live mic state and an explicit setter. We pass the
// desired state (not a flip) so a quick tap — keydown then keyup before the
// unmute resolves — still ends muted (livekit-client serialises the calls).
type PushToTalk = {
  micEnabled: boolean;
  micPending: boolean;
  setMic: (on: boolean) => void;
};

type Props = {
  // Flip the microphone (Cmd/Ctrl+D). Callers gate on `pending`.
  onToggleAudio: () => void;
  // Flip the camera (Cmd/Ctrl+E).
  onToggleCamera: () => void;
  // Omitted where push-to-talk has nothing to talk into (the Device Check).
  pushToTalk?: PushToTalk;
};

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

// Space must stay literal while typing — the chat box and name field.
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useCallShortcuts(props: Props): void {
  // Latest props without re-binding the listeners every render.
  const ref = useRef(props);
  useEffect(() => {
    ref.current = props;
  });

  useEffect(() => {
    const mac = isMacPlatform();
    // Match *only* the bare platform modifier — Cmd alone on macOS, Ctrl alone
    // elsewhere — with no other modifier held, so combos that mean something to
    // the OS/browser/extensions (⌃⌘D macOS Dictionary, ⌘⇧E, AltGr+D …) fall
    // through untouched. We only ever take the unmodified ⌘D/⌘E.
    const onlyModifier = (e: KeyboardEvent) => (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && !e.altKey && !e.shiftKey;

    // True while a push-to-talk hold has temporarily unmuted the mic, so keyup
    // (or focus loss) knows to mute it again — and only once per hold.
    let talking = false;
    function reMute() {
      if (!talking) return;
      talking = false;
      ref.current.pushToTalk?.setMic(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      const { onToggleAudio, onToggleCamera, pushToTalk } = ref.current;

      // ⌘/Ctrl+D / +E — mirror the mic / camera buttons. stopImmediatePropagation
      // keeps the combo from the browser's default AND from any extension's
      // keydown listener; we are in the capture phase so we run first.
      if (onlyModifier(e)) {
        if (e.code === 'KeyD') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) onToggleAudio();
        } else if (e.code === 'KeyE') {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) onToggleCamera();
        }
        return;
      }

      // Push to talk — hold Space to talk while muted. Inert without a config
      // (the Device Check) and while typing. Shift+Space (scroll up) and any
      // modified Space pass through.
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (!pushToTalk || isTextEntry(e.target)) return;
        e.preventDefault(); // stop page scroll / activating a focused button
        if (e.repeat || talking) return; // one unmute per hold; ignore auto-repeat
        if (!pushToTalk.micEnabled && !pushToTalk.micPending) {
          talking = true;
          pushToTalk.setMic(true);
        }
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' && talking) {
        e.preventDefault();
        reMute();
      }
    }

    // Capture phase on window: fire before page/extension listeners deeper in
    // the tree, and before the browser acts on the combo.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    // Lost focus mid-hold (Cmd-Tab, click away) — keyup may never arrive, so
    // mute now rather than leave the mic stuck open.
    window.addEventListener('blur', reMute);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', reMute);
      reMute();
    };
  }, []);
}

// '⌘' on macOS, 'Ctrl' elsewhere — for tooltip hints. useSyncExternalStore so
// SSR renders a stable value with no hydration mismatch when it differs.
const noopSubscribe = () => () => {};
export function useModifierKeyLabel(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => (isMacPlatform() ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}
