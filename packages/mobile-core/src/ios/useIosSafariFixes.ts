import { useEffect } from "react";
import { isBrowser, isIOS, isSafari } from "../env";

/**
 * Small, safe iOS Safari fixes:
 * - disables double-tap-to-zoom delays for buttons (via touch-action)
 * - ensures inputs don't auto-zoom by recommending 16px font (cannot enforce here)
 * - adds -webkit-overflow-scrolling: touch helper class hook (optional)
 */
export function useIosSafariFixes() {
  useEffect(() => {
    if (!isBrowser || !isIOS || !isSafari) return;

    document.documentElement.classList.add("ttt-ios-safari");
    return () => document.documentElement.classList.remove("ttt-ios-safari");
  }, []);
}
