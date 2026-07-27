'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteControlInputEvent } from '@/lib/controlProtocol';

const BUTTONS: Record<number, 'left' | 'middle' | 'right'> = { 0: 'left', 1: 'middle', 2: 'right' };

// An explicitly focused input surface over the contained screen track. The
// browser only transports bounded events; the Control Agent remains the final
// authority for injection.
export default function RemoteControlSurface({
  sendInput,
  onClipboardCopy,
  onClipboardPaste,
  onEscape,
}: {
  sendInput: (event: RemoteControlInputEvent) => void;
  onClipboardCopy: () => void;
  onClipboardPaste: () => void;
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const controlCursorRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const pendingScroll = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const raf = useRef<number | null>(null);
  const pressedKeys = useRef(new Map<string, { code: string; key?: string }>());
  const interceptedClipboardKeys = useRef(new Set<string>());
  const lastEscapeAt = useRef(0);
  const [focused, setFocused] = useState(false);

  const getVideoContentBounds = useCallback(() => {
    const video = ref.current?.parentElement?.querySelector('video');
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const rect = video.getBoundingClientRect();
    const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      width,
      height,
    };
  }, []);

  const toNorm = useCallback(
    (clientX: number, clientY: number, clamp: boolean) => {
      const bounds = getVideoContentBounds();
      if (!bounds) return null;
      let x = (clientX - bounds.left) / bounds.width;
      let y = (clientY - bounds.top) / bounds.height;
      if (clamp) {
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
      } else if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      return { x, y };
    },
    [getVideoContentBounds],
  );

  const hideControlCursor = useCallback(() => {
    const cursor = controlCursorRef.current;
    if (!cursor) return;
    cursor.style.opacity = '0';
    cursor.removeAttribute('data-pressed');
    const halo = cursor.querySelector<HTMLElement>('[data-control-cursor-halo]');
    if (halo) halo.style.opacity = '0';
  }, []);

  const setControlCursorPressed = useCallback((pressed: boolean) => {
    const cursor = controlCursorRef.current;
    if (!cursor) return;
    if (pressed) cursor.setAttribute('data-pressed', '');
    else cursor.removeAttribute('data-pressed');
    const halo = cursor.querySelector<HTMLElement>('[data-control-cursor-halo]');
    if (halo) halo.style.opacity = pressed ? '1' : '0';
  }, []);

  const updateControlCursor = useCallback(
    (point: { x: number; y: number }, pointerType: string) => {
      if (pointerType !== 'mouse' && pointerType !== 'pen') {
        hideControlCursor();
        return;
      }
      const cursor = controlCursorRef.current;
      const surface = ref.current?.getBoundingClientRect();
      const bounds = getVideoContentBounds();
      if (!cursor || !surface || !bounds) return;
      const x = bounds.left - surface.left + point.x * bounds.width;
      const y = bounds.top - surface.top + point.y * bounds.height;
      // This cursor is intentionally updated outside React state. It is
      // immediate Controller feedback, while the rAF-coalesced input stream
      // remains the authority path to the Control Agent.
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      cursor.style.opacity = '1';
    },
    [getVideoContentBounds, hideControlCursor],
  );

  const flush = useCallback(() => {
    raf.current = null;
    if (pendingMove.current) {
      sendInput({ kind: 'move', ...pendingMove.current });
      pendingMove.current = null;
    }
    if (pendingScroll.current) {
      sendInput({ kind: 'scroll', ...pendingScroll.current });
      pendingScroll.current = null;
    }
  }, [sendInput]);

  const schedule = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(flush);
  }, [flush]);

  const releaseAll = useCallback(() => {
    if (dragging.current || pressedKeys.current.size) sendInput({ kind: 'release-all' });
    dragging.current = false;
    pressedKeys.current.clear();
    interceptedClipboardKeys.current.clear();
  }, [sendInput]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!focused) return;
      const point = toNorm(event.clientX, event.clientY, false);
      if (!point) return;
      event.preventDefault();
      const prior = pendingScroll.current;
      pendingScroll.current = {
        ...point,
        dx: Math.max(-2000, Math.min(2000, (prior?.dx ?? 0) + event.deltaX)),
        dy: Math.max(-2000, Math.min(2000, (prior?.dy ?? 0) + event.deltaY)),
      };
      schedule();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [focused, schedule, toNorm]);

  useEffect(() => {
    if (!focused) return;
    const modifiers = (event: KeyboardEvent): ('shift' | 'ctrl' | 'alt' | 'meta')[] => {
      const value: ('shift' | 'ctrl' | 'alt' | 'meta')[] = [];
      if (event.shiftKey) value.push('shift');
      if (event.ctrlKey) value.push('ctrl');
      if (event.altKey) value.push('alt');
      if (event.metaKey) value.push('meta');
      return value;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscapeAt.current <= 600) onEscape?.();
        lastEscapeAt.current = now;
        releaseAll();
        return;
      }
      const isMacController = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const primaryModifier = isMacController ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (primaryModifier && !event.altKey && (event.code === 'KeyC' || event.code === 'KeyV')) {
        interceptedClipboardKeys.current.add(event.code);
        if (event.code === 'KeyC') onClipboardCopy();
        else onClipboardPaste();
        return;
      }
      pressedKeys.current.set(event.code, { code: event.code, key: event.key });
      sendInput({ kind: 'key', action: 'down', code: event.code, key: event.key.slice(0, 64), modifiers: modifiers(event) });
    };
    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (interceptedClipboardKeys.current.delete(event.code)) return;
      pressedKeys.current.delete(event.code);
      sendInput({ kind: 'key', action: 'up', code: event.code, key: event.key.slice(0, 64), modifiers: modifiers(event) });
    };
    const onVisibility = () => {
      if (!document.hidden) return;
      hideControlCursor();
      releaseAll();
    };
    const onWindowBlur = () => {
      hideControlCursor();
      releaseAll();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseAll();
    };
  }, [focused, hideControlCursor, onClipboardCopy, onClipboardPaste, onEscape, releaseAll, sendInput]);

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      hideControlCursor();
      releaseAll();
    },
    [hideControlCursor, releaseAll],
  );

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-remote-control-input
      role="application"
      aria-label="Remote Control screen. Click to focus, then use your mouse and keyboard. Copy and Paste use this computer's normal shortcuts. Press Escape twice to stop controlling."
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        hideControlCursor();
        releaseAll();
      }}
      onPointerMove={(event) => {
        if (!focused) return;
        const point = toNorm(event.clientX, event.clientY, dragging.current);
        if (!point) {
          hideControlCursor();
          return;
        }
        updateControlCursor(point, event.pointerType);
        pendingMove.current = point;
        schedule();
      }}
      onPointerDown={(event) => {
        if (!focused) {
          hideControlCursor();
          event.currentTarget.focus();
          return;
        }
        const button = BUTTONS[event.button];
        const point = toNorm(event.clientX, event.clientY, false);
        if (!button || !point) {
          hideControlCursor();
          return;
        }
        updateControlCursor(point, event.pointerType);
        setControlCursorPressed(event.pointerType === 'mouse' || event.pointerType === 'pen');
        event.preventDefault();
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        sendInput({ kind: 'down', ...point, button });
      }}
      onPointerUp={(event) => {
        const wasDragging = dragging.current;
        const button = BUTTONS[event.button];
        const point = toNorm(event.clientX, event.clientY, true);
        dragging.current = false;
        if (!wasDragging) {
          hideControlCursor();
          return;
        }
        setControlCursorPressed(false);
        if (point) updateControlCursor(point, event.pointerType);
        else hideControlCursor();
        if (button && point) sendInput({ kind: 'up', ...point, button });
      }}
      onPointerCancel={() => {
        hideControlCursor();
        releaseAll();
      }}
      onLostPointerCapture={() => {
        // Pointer capture is released automatically after a normal pointer-up.
        // Only a loss while dragging is an interrupted control gesture.
        if (!dragging.current) return;
        hideControlCursor();
        releaseAll();
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={`absolute inset-0 z-10 touch-none rounded-[inherit] ring-2 ring-inset ${
        focused ? 'cursor-none ring-cyan/80' : 'cursor-crosshair ring-cyan/30'
      }`}
    >
      {!focused && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white/80">
          Click to control this desktop
        </span>
      )}
      <div
        ref={controlCursorRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 will-change-transform"
        style={{ transform: 'translate3d(-9999px, -9999px, 0)' }}
      >
        <span
          data-control-cursor-halo
          className="absolute -left-2 -top-2 h-8 w-8 rounded-full border border-cyan/70 bg-cyan/15 transition-opacity duration-75"
          style={{ opacity: 0 }}
        />
        <svg viewBox="0 0 24 24" className="relative h-6 w-6 overflow-visible drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
          <path d="M2 1.5 4.4 21l5.2-6.1 4.3 7.4 4.1-2.4-4.4-7.4 8.4-.8L2 1.5Z" fill="white" stroke="black" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </div>
    </div>
  );
}
