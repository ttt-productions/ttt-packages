import { useEffect } from "react";
import { isBrowser, isIOS, isSafari } from "../../env.js";
import { resolvePrefix, type CssPrefixOptions } from "../css-prefix.js";

/**
 * Small, safe iOS Safari fixes:
 * - disables double-tap-to-zoom delays for buttons (via touch-action)
 * - ensures inputs don't auto-zoom by recommending 16px font (cannot enforce here)
 * - adds -webkit-overflow-scrolling: touch helper class hook (optional)
 *
 * Default class: `app-ios-safari`. Override via `cssPrefix`.
 */
export function useIosSafariFixes(options?: CssPrefixOptions) {
  const prefix = resolvePrefix(options);
  useEffect(() => {
    if (!isBrowser || !isIOS || !isSafari) return;

    document.documentElement.classList.add(`${prefix}-ios-safari`);
    return () => document.documentElement.classList.remove(`${prefix}-ios-safari`);
  }, [prefix]);
}
