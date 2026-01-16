import { useEffect, useMemo, useState } from "react";
import { hasVisualViewport, isBrowser } from "../env";
import type { KeyboardState } from "../types";

/**
 * Best effort keyboard detection:
 * - iOS Safari: visualViewport.height shrinks when keyboard shows
 * - fallback: focusin/focusout heuristics + innerHeight snapshots
 */
export function useKeyboard(): KeyboardState {
  const [baseline, setBaseline] = useState<number>(() => (isBrowser ? window.innerHeight : 0));
  const [height, setHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<KeyboardState["source"]>("fallback");

  useEffect(() => {
    if (!isBrowser) return;

    const setBaseIfNeeded = () => {
      // update baseline when keyboard likely closed
      const vvH = window.visualViewport?.height ?? window.innerHeight;
      const inner = window.innerHeight;
      const candidate = Math.max(vvH, inner);
      setBaseline((b) => (Math.abs(candidate - b) > 40 ? candidate : b));
    };

    const onVV = () => {
      const vvH = window.visualViewport?.height ?? window.innerHeight;
      const delta = Math.max(0, Math.round(baseline - vvH));
      const isOpen = delta > 80; // threshold
      setSource("visualViewport");
      setHeight(isOpen ? delta : 0);
      setOpen(isOpen);
      if (!isOpen) setBaseIfNeeded();
    };

    const onFocusIn = () => {
      // baseline snapshot on focus to reduce false positives
      setBaseline((b) => Math.max(b, window.innerHeight));
    };
    const onFocusOut = () => {
      // allow baseline update shortly after blur
      setTimeout(setBaseIfNeeded, 50);
      setTimeout(() => {
        setOpen(false);
        setHeight(0);
      }, 250);
    };

    if (hasVisualViewport) {
      window.visualViewport!.addEventListener("resize", onVV, { passive: true });
      window.visualViewport!.addEventListener("scroll", onVV, { passive: true });
      onVV();
    }

    window.addEventListener("focusin", onFocusIn, { passive: true } as any);
    window.addEventListener("focusout", onFocusOut, { passive: true } as any);
    window.addEventListener("orientationchange", setBaseIfNeeded, { passive: true });

    setBaseIfNeeded();

    return () => {
      if (hasVisualViewport) {
        window.visualViewport!.removeEventListener("resize", onVV);
        window.visualViewport!.removeEventListener("scroll", onVV);
      }
      window.removeEventListener("focusin", onFocusIn as any);
      window.removeEventListener("focusout", onFocusOut as any);
      window.removeEventListener("orientationchange", setBaseIfNeeded);
    };
  }, [baseline]);

  return useMemo(() => ({ isOpen: open, height, source }), [open, height, source]);
}
