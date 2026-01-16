import { useEffect } from "react";
import { isBrowser } from "../env";

/**
 * Locks body scroll (mobile sheet/modal fix).
 * - preserves current scroll position
 * - iOS safe enough for common cases
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!isBrowser) return;
    if (!locked) return;

    const { body } = document;
    const scrollY = window.scrollY;

    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflowY: body.style.overflowY,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflowY = "scroll";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflowY = prev.overflowY;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
