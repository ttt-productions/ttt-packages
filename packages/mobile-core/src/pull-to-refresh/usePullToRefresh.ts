import { useCallback, useRef, useState, type CSSProperties, type RefObject, type TouchEventHandler } from "react";
import { isBrowser } from "../env";

type PullToRefreshOptions = {
  onRefresh: () => Promise<void>;
  /** Scroll container ref. Omit to use window scroll (document.scrollingElement). */
  containerRef?: RefObject<HTMLElement | null>;
  /** Pixels the user must pull before a refresh triggers (default 80). */
  threshold?: number;
  /** Max pixels the indicator can stretch (default 120). */
  maxPull?: number;
  /** Disable the gesture entirely. */
  disabled?: boolean;
};

type PullToRefreshResult = {
  isRefreshing: boolean;
  /** 0-1 progress toward the threshold. */
  pullProgress: number;
  /** Current pull distance in px (for indicator positioning). */
  pullDistance: number;
  handlers: {
    onTouchStart: TouchEventHandler;
    onTouchMove: TouchEventHandler;
    onTouchEnd: TouchEventHandler;
  };
  /** Apply to the content wrapper for the translateY shift. */
  style: CSSProperties;
};

/**
 * Pull-to-refresh gesture for mobile web.
 *
 * Desktop-safe: touch handlers simply never fire on non-touch devices.
 */
export function usePullToRefresh(opts: PullToRefreshOptions): PullToRefreshResult {
  const {
    onRefresh,
    containerRef,
    threshold = 80,
    maxPull = 120,
    disabled = false,
  } = opts;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const getScrollTop = useCallback((): number => {
    if (!isBrowser) return 1; // pretend not at top in SSR
    if (containerRef?.current) return containerRef.current.scrollTop;
    return document.scrollingElement?.scrollTop ?? window.scrollY;
  }, [containerRef]);

  const onTouchStart: TouchEventHandler = useCallback(
    (e) => {
      if (disabled || isRefreshing) return;
      if (getScrollTop() > 0) return; // not at top
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    },
    [disabled, isRefreshing, getScrollTop]
  );

  const onTouchMove: TouchEventHandler = useCallback(
    (e) => {
      if (!pullingRef.current || disabled || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const delta = currentY - startYRef.current;

      if (delta <= 0) {
        // scrolling up — cancel pull
        setPullDistance(0);
        return;
      }

      // If the user has scrolled away from top mid-gesture, cancel
      if (getScrollTop() > 0) {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }

      // Apply resistance: diminishing returns past threshold
      const clamped = Math.min(delta, maxPull);
      const resisted = clamped < threshold
        ? clamped
        : threshold + (clamped - threshold) * 0.4;

      setPullDistance(resisted);
    },
    [disabled, isRefreshing, threshold, maxPull, getScrollTop]
  );

  const onTouchEnd: TouchEventHandler = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5); // hold at half-threshold during refresh
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(1, pullDistance / threshold);

  const style: CSSProperties = {
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
    transition: pullingRef.current ? "none" : "transform 0.3s ease-out",
  };

  return {
    isRefreshing,
    pullProgress: progress,
    pullDistance,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    style,
  };
}
