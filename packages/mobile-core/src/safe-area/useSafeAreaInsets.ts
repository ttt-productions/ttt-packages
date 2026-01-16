import { useEffect, useState } from "react";
import type { Insets } from "../types";
import { isBrowser } from "../env";

/**
 * Uses CSS env(safe-area-inset-*) by writing them to CSS vars and reading computed values.
 * Works on iOS Safari; harmless elsewhere.
 */
export function useSafeAreaInsets(): Insets {
  const [insets, setInsets] = useState<Insets>({ top: 0, right: 0, bottom: 0, left: 0 });

  useEffect(() => {
    if (!isBrowser) return;

    const el = document.documentElement;

    // set vars once
    el.style.setProperty("--ttt-sai-top", "env(safe-area-inset-top)");
    el.style.setProperty("--ttt-sai-right", "env(safe-area-inset-right)");
    el.style.setProperty("--ttt-sai-bottom", "env(safe-area-inset-bottom)");
    el.style.setProperty("--ttt-sai-left", "env(safe-area-inset-left)");

    const read = () => {
      const cs = getComputedStyle(el);
      const px = (v: string) => Math.max(0, Math.round(parseFloat(v || "0")));
      setInsets({
        top: px(cs.getPropertyValue("--ttt-sai-top")),
        right: px(cs.getPropertyValue("--ttt-sai-right")),
        bottom: px(cs.getPropertyValue("--ttt-sai-bottom")),
        left: px(cs.getPropertyValue("--ttt-sai-left")),
      });
    };

    read();
    window.addEventListener("resize", read, { passive: true });
    window.addEventListener("orientationchange", read, { passive: true });
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  return insets;
}
