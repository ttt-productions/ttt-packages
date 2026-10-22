import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type TouchEventHandler,
} from 'react';
import { isBrowser } from '../../env.js';

type PullToRefreshOptions = {
  onRefresh: () => Promise<void>;
  containerRef?: RefObject<HTMLElement | null>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
};

type PullToRefreshResult = {
  isRefreshing: boolean;
  pullProgress: number;
  pullDistance: number;
  handlers: {
    onTouchStart: TouchEventHandler;
    onTouchMove: TouchEventHandler;
    onTouchEnd: TouchEventHandler;
  };
  style: CSSProperties;
};

export function usePullToRefresh(opts: PullToRefreshOptions): PullToRefreshResult {
  const { onRefresh, containerRef, threshold = 80, maxPull = 120, disabled = false } = opts;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const getScrollTop = useCallback((): number => {
    if (!isBrowser) return 1;
    if (containerRef?.current) return containerRef.current.scrollTop;
    return document.scrollingElement?.scrollTop ?? window.scrollY;
  }, [containerRef]);

  const onTouchStart: TouchEventHandler = useCallback(
    (e) => {
      if (disabled || isRefreshing) return;
      if (getScrollTop() > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    },
    [disabled, isRefreshing, getScrollTop],
  );

  const onTouchMove: TouchEventHandler = useCallback(
    (e) => {
      if (!pullingRef.current || disabled || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const delta = currentY - startYRef.current;

      if (delta <= 0) {
        setPullDistance(0);
        return;
      }

      if (getScrollTop() > 0) {
        pullingRef.current = false;
        setPullDistance(0);
        return;
      }

      const clamped = Math.min(delta, maxPull);
      const resisted = clamped < threshold ? clamped : threshold + (clamped - threshold) * 0.4;

      setPullDistance(resisted);
    },
    [disabled, isRefreshing, threshold, maxPull, getScrollTop],
  );

  const onTouchEnd: TouchEventHandler = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5);
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
    transition: pullingRef.current ? 'none' : 'transform var(--motion-slow) var(--motion-ease)',
  };

  return {
    isRefreshing,
    pullProgress: progress,
    pullDistance,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    style,
  };
}
