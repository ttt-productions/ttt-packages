import { useEffect } from 'react';
import { isBrowser, isIOS } from '../../env.js';

export function useNoRubberBand(enabled: boolean) {
  useEffect(() => {
    if (!isBrowser || !isIOS || !enabled) return;

    const el = document.documentElement;
    const prev = el.style.overscrollBehaviorY;
    el.style.overscrollBehaviorY = 'none';

    return () => {
      el.style.overscrollBehaviorY = prev;
    };
  }, [enabled]);
}
