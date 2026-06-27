import { useEffect, useRef, type RefObject } from 'react';

// Dismiss a side panel (Chat, Host controls) on a pointer press anywhere outside
// its own element, or on Escape. Used by the call's full-height side drawers.
//
// Deliberately passive: the listener never preventDefaults, so the same press
// still reaches whatever is under it — clicking Mute mutes *and* closes the
// panel, a tile pins *and* closes. There is no backdrop, so the call stays fully
// interactive. "Outside" is evaluated per panel against its own ref, so when a
// host has both drawers open, a press in either one closes the other and a press
// in the neutral middle closes both.
//
// `ignoreSelector` carves out a trigger that lives outside the panel but must not
// dismiss it — namely the chat toggle in the control bar. Without it the press
// would close chat (pointerdown) only for the toggle's own click to reopen it.
export function useDismissOnOutside(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, options?: { ignoreSelector?: string }): void {
  // Latest onClose without rebinding the listeners every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const ignoreSelector = options?.ignoreSelector;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      const el = ref.current;
      if (!el || !target) return;
      if (el.contains(target)) return; // inside the panel
      if (ignoreSelector && target.closest(ignoreSelector)) return; // excluded trigger
      onCloseRef.current();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, open, ignoreSelector]);
}
