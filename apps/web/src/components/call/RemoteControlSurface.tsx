'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteControlInputEvent } from '@/lib/controlProtocol';

const BUTTONS: Record<number, 'left' | 'middle' | 'right'> = { 0: 'left', 1: 'middle', 2: 'right' };

// An explicitly focused input surface over the contained screen track. The
// browser only transports bounded events; the Control Agent remains the final
// authority for injection.
export default function RemoteControlSurface({ sendInput, onEscape }: { sendInput: (event: RemoteControlInputEvent) => void; onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const pendingScroll = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const raf = useRef<number | null>(null);
  const pressedKeys = useRef(new Map<string, { code: string; key?: string }>());
  const lastEscapeAt = useRef(0);
  const [focused, setFocused] = useState(false);

  const toNorm = useCallback((clientX: number, clientY: number, clamp: boolean) => {
    const video = ref.current?.parentElement?.querySelector('video');
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const rect = video.getBoundingClientRect();
    const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    let x = (clientX - rect.left - (rect.width - width) / 2) / width;
    let y = (clientY - rect.top - (rect.height - height) / 2) / height;
    if (clamp) {
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
    } else if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x, y };
  }, []);

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
      pressedKeys.current.set(event.code, { code: event.code, key: event.key });
      sendInput({ kind: 'key', action: 'down', code: event.code, key: event.key.slice(0, 64), modifiers: modifiers(event) });
    };
    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      pressedKeys.current.delete(event.code);
      sendInput({ kind: 'key', action: 'up', code: event.code, key: event.key.slice(0, 64), modifiers: modifiers(event) });
    };
    const onVisibility = () => document.hidden && releaseAll();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseAll();
    };
  }, [focused, onEscape, releaseAll, sendInput]);

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      releaseAll();
    },
    [releaseAll],
  );

  return (
    <div
      ref={ref}
      tabIndex={0}
      data-remote-control-input
      role="application"
      aria-label="Remote Control screen. Click to focus, then use your mouse and keyboard. Press Escape twice to stop controlling."
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        releaseAll();
      }}
      onPointerMove={(event) => {
        if (!focused) return;
        const point = toNorm(event.clientX, event.clientY, dragging.current);
        if (point) {
          pendingMove.current = point;
          schedule();
        }
      }}
      onPointerDown={(event) => {
        if (!focused) {
          event.currentTarget.focus();
          return;
        }
        const button = BUTTONS[event.button];
        const point = toNorm(event.clientX, event.clientY, false);
        if (!button || !point) return;
        event.preventDefault();
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        sendInput({ kind: 'down', ...point, button });
      }}
      onPointerUp={(event) => {
        const button = BUTTONS[event.button];
        const point = toNorm(event.clientX, event.clientY, true);
        dragging.current = false;
        if (button && point) sendInput({ kind: 'up', ...point, button });
      }}
      onPointerCancel={releaseAll}
      onLostPointerCapture={releaseAll}
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
    </div>
  );
}
