import { useEffect } from "react";
import { isBrowser } from "../../env.js";
import { resolvePrefix, type CssPrefixOptions } from "../css-prefix.js";

/**
 * Sets:
 *  --<prefix>-vh: 1% of *layout* viewport height (window.innerHeight)
 *  --<prefix>-dvh: 1% of *visual* viewport height (visualViewport.height when available)
 *
 * Default prefix is "app": --app-vh / --app-dvh.
 *
 * Use in CSS:
 *  height: calc(var(--app-dvh, var(--app-vh, 1vh)) * 100);
 */
export function useViewportHeightVars(options?: CssPrefixOptions) {
  const prefix = resolvePrefix(options);
  useEffect(() => {
    if (!isBrowser) return;

    const apply = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty(`--${prefix}-vh`, `${vh}px`);

      const dvh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
      document.documentElement.style.setProperty(`--${prefix}-dvh`, `${dvh}px`);
    };

    apply();
    window.addEventListener("resize", apply, { passive: true });
    window.visualViewport?.addEventListener("resize", apply, { passive: true });
    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, [prefix]);
}
