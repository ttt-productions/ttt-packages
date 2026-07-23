"use client";

import * as React from "react";
import { LOAD_WATCHDOG_MS } from "../recovery.js";

/**
 * Bounded load watchdog shared by the three viewers. While `armed`, a media
 * element is expected to produce a load (or at least metadata) or error event
 * within `timeoutMs`; when neither arrives, `onTimeout` fires so the viewer
 * can synthesize an error and hand the asset to the bounded recovery path —
 * no viewer may sit on a skeleton forever.
 *
 * A hidden document pauses the deadline (browsers deprioritize background
 * loads): if the timer fires while the tab is hidden, it re-arms for a full
 * period instead of failing the asset.
 *
 * `timeoutMs <= 0` disables the watchdog. No IntersectionObserver is used
 * (MEDIA-102) — visibility gating comes from the caller's `armed` flag, which
 * viewers derive from their existing single observer's `shouldLoad`.
 */
export function useLoadWatchdog(
  armed: boolean,
  timeoutMs: number | undefined,
  onTimeout: () => void
): void {
  const onTimeoutRef = React.useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resolvedTimeout = timeoutMs ?? LOAD_WATCHDOG_MS;

  React.useEffect(() => {
    if (!armed || resolvedTimeout <= 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = () => {
      timer = setTimeout(() => {
        timer = null;
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "hidden"
        ) {
          arm();
          return;
        }
        onTimeoutRef.current();
      }, resolvedTimeout);
    };

    arm();

    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [armed, resolvedTimeout]);
}
