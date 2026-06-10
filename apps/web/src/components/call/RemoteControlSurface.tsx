"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ControlInputEvent, KeyModifier, MouseButton } from "@/lib/controlProtocol";

// Input-capture overlay rendered over the presented video while I'm the
// Controller. Translates local pointer/keyboard activity into control:input
// events with coordinates normalized to [0,1] of the video's *content box* —
// the tile letterboxes with object-contain, so the black bars must not count.
// The agent owns the mapping from normalized coords to monitor pixels.
//
// Mouse moves coalesce to one per animation frame (they ride the lossy
// channel); wheel deltas accumulate per frame. Keys forward down/up once per
// physical press (no auto-repeats — the controlled OS generates its own while
// the key is held). Paste-through: Cmd/Ctrl+V first ships the local clipboard
// so the remote paste has the controller's content.

const BUTTONS: Record<number, MouseButton> = { 0: "left", 1: "middle", 2: "right" };

export default function RemoteControlSurface({
  sendInput,
  sendClipboard,
}: {
  sendInput: (event: ControlInputEvent) => void;
  sendClipboard: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pendingMove = useRef<{ x: number; y: number } | null>(null);
  const pendingScroll = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const rafId = useRef<number | null>(null);
  const dragging = useRef(false);
  const pressedKeys = useRef(new Map<string, { key: string; code: string }>());

  // Map a client point to normalized video-content coordinates. While
  // dragging, clamp instead of dropping so edge-drags reach the remote edges.
  const toNorm = useCallback((clientX: number, clientY: number, clamp: boolean): { x: number; y: number } | null => {
    const video = ref.current?.parentElement?.querySelector("video");
    if (!video) return null;
    const rect = video.getBoundingClientRect();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || !rect.width || !rect.height) return null;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const contentW = vw * scale;
    const contentH = vh * scale;
    const originX = rect.left + (rect.width - contentW) / 2;
    const originY = rect.top + (rect.height - contentH) / 2;
    let x = (clientX - originX) / contentW;
    let y = (clientY - originY) / contentH;
    if (clamp) {
      x = Math.min(1, Math.max(0, x));
      y = Math.min(1, Math.max(0, y));
    } else if (x < 0 || x > 1 || y < 0 || y > 1) {
      return null; // hovering the letterbox, not the screen
    }
    return { x, y };
  }, []);

  const flushFrame = useCallback(() => {
    rafId.current = null;
    if (pendingMove.current) {
      sendInput({ kind: "move", ...pendingMove.current });
      pendingMove.current = null;
    }
    if (pendingScroll.current) {
      sendInput({ kind: "scroll", ...pendingScroll.current });
      pendingScroll.current = null;
    }
  }, [sendInput]);

  const scheduleFlush = useCallback(() => {
    rafId.current ??= requestAnimationFrame(flushFrame);
  }, [flushFrame]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const p = toNorm(e.clientX, e.clientY, dragging.current);
      if (!p) return;
      pendingMove.current = p;
      scheduleFlush();
    },
    [toNorm, scheduleFlush]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const button = BUTTONS[e.button];
      const p = toNorm(e.clientX, e.clientY, false);
      if (!button || !p) return;
      e.preventDefault();
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      sendInput({ kind: "down", ...p, button });
    },
    [toNorm, sendInput]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const button = BUTTONS[e.button];
      const p = toNorm(e.clientX, e.clientY, true);
      dragging.current = false;
      if (!button || !p) return;
      sendInput({ kind: "up", ...p, button });
    },
    [toNorm, sendInput]
  );

  // Wheel needs a non-passive native listener to swallow local scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      const p = toNorm(e.clientX, e.clientY, false);
      if (!p) return;
      e.preventDefault();
      const prev = pendingScroll.current;
      pendingScroll.current = {
        ...p,
        dx: (prev?.dx ?? 0) + e.deltaX,
        dy: (prev?.dy ?? 0) + e.deltaY,
      };
      scheduleFlush();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toNorm, scheduleFlush]);

  // Keyboard goes to the remote machine while the surface is mounted.
  useEffect(() => {
    function modifiers(e: KeyboardEvent): KeyModifier[] {
      const mods: KeyModifier[] = [];
      if (e.shiftKey) mods.push("shift");
      if (e.ctrlKey) mods.push("ctrl");
      if (e.altKey) mods.push("alt");
      if (e.metaKey) mods.push("meta");
      return mods;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return; // the controlled OS auto-repeats held keys itself
      e.preventDefault();
      pressedKeys.current.set(e.code, { key: e.key, code: e.code });

      // Paste-through: ship the local clipboard first, so the remote paste
      // pastes the controller's content (controller → controlled only here;
      // the agent pushes the other direction).
      const sendKey = () => sendInput({ kind: "key", action: "down", key: e.key, code: e.code, modifiers: modifiers(e) });
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyV" && navigator.clipboard?.readText) {
        navigator.clipboard
          .readText()
          .then((text) => sendClipboard(text))
          .catch(() => {}) // permission denied — the remote pastes its own clipboard
          .finally(sendKey);
        return;
      }
      sendKey();
    }

    function onKeyUp(e: KeyboardEvent) {
      e.preventDefault();
      pressedKeys.current.delete(e.code);
      sendInput({ kind: "key", action: "up", key: e.key, code: e.code, modifiers: modifiers(e) });
    }

    // If the controller tabs away mid-press, lift every held key so the
    // remote machine isn't left with a stuck modifier.
    function onBlur() {
      for (const { key, code } of pressedKeys.current.values()) {
        sendInput({ kind: "key", action: "up", key, code, modifiers: [] });
      }
      pressedKeys.current.clear();
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      onBlur(); // unmount = session over; don't leave keys held remotely
    };
  }, [sendInput, sendClipboard]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-10 cursor-crosshair touch-none rounded-[inherit] ring-2 ring-inset ring-cyan/50"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
