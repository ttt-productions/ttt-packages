import React from "react";
import { usePullToRefresh } from "./usePullToRefresh";

type Props = {
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

const INDICATOR_SIZE = 32;

function SpinnerIndicator({ progress, isRefreshing }: { progress: number; isRefreshing: boolean }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <svg
      width={INDICATOR_SIZE}
      height={INDICATOR_SIZE}
      viewBox="0 0 24 24"
      style={{
        display: "block",
        animation: isRefreshing ? "ttt-ptr-spin 0.8s linear infinite" : "none",
      }}
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity={0.15}
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={isRefreshing ? circumference * 0.25 : dashOffset}
        strokeLinecap="round"
        style={{ transition: isRefreshing ? "none" : "stroke-dashoffset 0.1s ease-out" }}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

/**
 * Drop-in wrapper that adds pull-to-refresh to its children.
 * Desktop-safe: touch handlers never fire, indicator never shows.
 *
 * Usage:
 * ```tsx
 * <PullToRefreshContainer onRefresh={async () => { await refetch(); }}>
 *   <YourContent />
 * </PullToRefreshContainer>
 * ```
 */
export function PullToRefreshContainer({ onRefresh, disabled, className, children }: Props) {
  const { isRefreshing, pullProgress, pullDistance, handlers, style } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  const showIndicator = pullDistance > 0 || isRefreshing;
  const indicatorOpacity = isRefreshing ? 1 : Math.min(1, pullProgress * 1.5);

  return (
    <>
      {/* Keyframe injected once — harmless if duplicated */}
      <style>{`@keyframes ttt-ptr-spin { to { transform: rotate(360deg); } }`}</style>

      <div
        className={className}
        {...handlers}
        style={{ position: "relative", overscrollBehaviorY: "contain" }}
      >
        {/* Indicator: positioned above content, revealed by pull */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            transform: `translateY(${showIndicator ? pullDistance - INDICATOR_SIZE - 8 : -INDICATOR_SIZE - 8}px)`,
            opacity: indicatorOpacity,
            transition: pullDistance > 0 && !isRefreshing ? "none" : "transform 0.3s ease-out, opacity 0.3s ease-out",
            pointerEvents: "none",
            zIndex: 10,
            color: "var(--foreground, currentColor)",
          }}
        >
          <SpinnerIndicator progress={pullProgress} isRefreshing={isRefreshing} />
        </div>

        {/* Content shifts down during pull */}
        <div style={style}>
          {children}
        </div>
      </div>
    </>
  );
}
