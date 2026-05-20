import { useEffect, useState } from "react";
import type { Insets } from "../../types.js";
import { isBrowser } from "../../env.js";
import { resolvePrefix, type CssPrefixOptions } from "../css-prefix.js";

/**
 * Uses CSS env(safe-area-inset-*) by writing them to CSS vars and reading computed values.
 * Works on iOS Safari; harmless elsewhere.
 * Default CSS vars: --app-sai-top/right/bottom/left.
 */
export function useSafeAreaInsets(options?: CssPrefixOptions): Insets {
  const prefix = resolvePrefix(options);
  const [insets, setInsets] = useState<Insets>({ top: 0, right: 0, bottom: 0, left: 0 });

  useEffect(() => {
    if (!isBrowser) return;

    const el = document.documentElement;

    // set vars once
    el.style.setProperty(`--${prefix}-sai-top`, "env(safe-area-inset-top)");
    el.style.setProperty(`--${prefix}-sai-right`, "env(safe-area-inset-right)");
    el.style.setProperty(`--${prefix}-sai-bottom`, "env(safe-area-inset-bottom)");
    el.style.setProperty(`--${prefix}-sai-left`, "env(safe-area-inset-left)");

    const read = () => {
      const cs = getComputedStyle(el);
      const px = (v: string) => Math.max(0, Math.round(parseFloat(v || "0")));
      setInsets({
        top: px(cs.getPropertyValue(`--${prefix}-sai-top`)),
        right: px(cs.getPropertyValue(`--${prefix}-sai-right`)),
        bottom: px(cs.getPropertyValue(`--${prefix}-sai-bottom`)),
        left: px(cs.getPropertyValue(`--${prefix}-sai-left`)),
      });
    };

    read();
    window.addEventListener("resize", read, { passive: true });
    window.addEventListener("orientationchange", read, { passive: true });
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, [prefix]);

  return insets;
}
