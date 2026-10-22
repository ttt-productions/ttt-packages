'use client';

import * as React from 'react';
import { LOAD_WATCHDOG_MS } from '../recovery.js';

/** Browsers deprioritize background loads, so a deadline that passes while the tab is hidden re-arms. */
export function useLoadWatchdog(
  armed: boolean,
  timeoutMs: number | undefined,
  onTimeout: () => void,
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
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
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
