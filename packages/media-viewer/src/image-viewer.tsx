import * as React from "react";
import { useInView } from "react-intersection-observer";
import { Skeleton } from "@ttt-productions/ui-core";
import type { ImageViewerProps } from "./types";

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
    fallback,
  } = props;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const [zoomed, setZoomed] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: !unloadOnExit,
    threshold: 0.01,
    rootMargin: "50px",
    skip: priority || !lazy,
  });

  // Load when entering viewport
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

  // Reset error state when URL changes
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

  if (hasError) {
    return fallback ? <>{fallback}</> : null;
  }

  const wrapperStyle: React.CSSProperties = isCircular
    ? { borderRadius: "50%", overflow: "hidden" }
    : {};

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
            transition: "opacity 300ms ease, transform 150ms ease",
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
