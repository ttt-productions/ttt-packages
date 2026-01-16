import { useEffect } from "react";
import { isBrowser } from "../env";

/**
 * Sets:
 *  --ttt-vh: 1% of *layout* viewport height (window.innerHeight)
 *  --ttt-dvh: 1% of *visual* viewport height (visualViewport.height when available)
 *
 * Use in CSS:
 *  height: calc(var(--ttt-dvh, var(--ttt-vh, 1vh)) * 100);
 */
export function useViewportHeightVars() {
  useEffect(() => {
    if (!isBrowser) return;

    const apply = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--ttt-vh", `${vh}px`);

      const dvh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
      document.documentElement.style.setProperty("--ttt-dvh", `${dvh}px`);
    };

    apply();
    window.addEventListener("resize", apply, { passive: true });
    window.visualViewport?.addEventListener("resize", apply, { passive: true });
    return () => {
      window.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);
}
