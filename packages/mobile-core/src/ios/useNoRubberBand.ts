import { useEffect } from "react";
import { isBrowser, isIOS } from "../env";

/**
 * Prevents iOS rubber-band scroll on the document by limiting overscroll chaining.
 * Use sparingly (e.g., full-screen experiences).
 */
export function useNoRubberBand(enabled: boolean) {
  useEffect(() => {
    if (!isBrowser || !isIOS || !enabled) return;

    const el = document.documentElement;
    const prev = el.style.overscrollBehaviorY as any;
    (el.style as any).overscrollBehaviorY = "none";

    return () => {
      (el.style as any).overscrollBehaviorY = prev;
    };
  }, [enabled]);
}
