import * as React from "react";
import { useInView } from "react-intersection-observer";
import { Skeleton } from "@ttt-productions/ui-core/react";
import type { ImageViewerProps } from "../types.js";
import { useLoadWatchdog } from "./use-load-watchdog.js";

export function ImageViewer(props: ImageViewerProps) {
  const {
    url,
    alt,
    className,
    mediaClassName,
    enableZoom = true,
    lazy = true,
    unloadOnExit = false,
    priority = false,
    skeleton: showSkeleton = true,
    isCircular = false,
    preventGestures = true,
    onLoad,
    onError,
    onVisibilityChange,
    fallback,
    loadTimeoutMs,
  } = props;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const [zoomed, setZoomed] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // The viewer's one observer (MEDIA-102): lazy-load gating, and — while an owner listens —
  // the visibility it reports, which is why it keeps observing after the first sighting then.
  const { ref: inViewRef, inView } = useInView({
    triggerOnce: !unloadOnExit && !onVisibilityChange,
    threshold: 0.01,
    rootMargin: "50px",
    skip: priority || !lazy,
    onChange: (visible) => onVisibilityChange?.(visible),
  });

  React.useEffect(() => {
    if (inView && !shouldLoad) {
      setShouldLoad(true);
    }
    // Unload when leaving viewport (if enabled)
    if (!inView && unloadOnExit && shouldLoad && !priority) {
      setShouldLoad(false);
      setIsLoaded(false);
    }
  }, [inView, shouldLoad, unloadOnExit, priority]);

  React.useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [url]);

  const handleLoad = React.useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = React.useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Bounded load: a visible image that fires neither load nor error within the
  // budget is treated as errored so it resolves instead of skeleton-ing forever.
  useLoadWatchdog(shouldLoad && !isLoaded && !hasError, loadTimeoutMs, handleError);

  // iOS: prevent multi-touch zoom gestures on the image
  React.useEffect(() => {
    const img = imgRef.current;
    if (!img || !preventGestures) return;

    const prevent = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    img.addEventListener("touchstart", prevent, { passive: false });
    return () => {
      img.removeEventListener("touchstart", prevent);
    };
  }, [preventGestures, shouldLoad]);

  const toggleZoom = React.useCallback(() => {
    if (!enableZoom) return;
    setZoomed((z) => !z);
  }, [enableZoom]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableZoom) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleZoom();
      }
    },
    [enableZoom, toggleZoom]
  );

  const wrapperStyle: React.CSSProperties = isCircular
    ? { borderRadius: "50%", overflow: "hidden" }
    : {};

  // The error state stays inside the observed wrapper, so the viewer keeps reporting
  // its visibility while its owner recovers it.
  if (hasError) {
    return fallback ? (
      <div
        ref={inViewRef}
        className={className}
        style={{ position: "relative", width: "100%", height: "100%", ...wrapperStyle }}
      >
        {fallback}
      </div>
    ) : null;
  }

  return (
    <div
      ref={inViewRef}
      className={className}
      role={enableZoom ? "button" : undefined}
      tabIndex={enableZoom ? 0 : undefined}
      aria-pressed={enableZoom ? zoomed : undefined}
      aria-label={enableZoom ? (zoomed ? "Zoom out image" : "Zoom in image") : undefined}
      onClick={toggleZoom}
      onKeyDown={onKeyDown}
      style={{ position: "relative", width: "100%", height: "100%", outline: "none", ...wrapperStyle }}
    >
      {showSkeleton && !isLoaded && shouldLoad && (
        <Skeleton style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      )}
      {shouldLoad && (
        <img
          ref={imgRef}
          src={url}
          alt={alt ?? ""}
          draggable={false}
          className={mediaClassName}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: isLoaded ? 1 : 0,
            transition: "opacity var(--motion-slow) var(--motion-ease), transform var(--motion-fast) var(--motion-ease)",
            transform: zoomed ? "scale(1.5)" : "scale(1)",
            cursor: enableZoom ? (zoomed ? "zoom-out" : "zoom-in") : undefined,
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            WebkitTapHighlightColor: "transparent",
          } as React.CSSProperties}
        />
      )}
    </div>
  );
}
