import * as React from "react";
import { useInView } from "react-intersection-observer";
import { Skeleton } from "@ttt-productions/ui-core";
import type { VideoViewerProps } from "./types";

export function VideoViewer(props: VideoViewerProps) {
  const {
    url,
    className,
    mediaClassName,
    controls = true,
    autoPlay = false,
    muted,
    loop = false,
    posterUrl,
    enableFullscreen = true,
    lazy = true,
    unloadOnExit = true,
    priority = false,
    skeleton: showSkeleton = true,
    preload = "metadata",
    autoPlayOnVisible = false,
    onLoad,
    onError,
    fallback,
  } = props;

  const resolvedMuted = muted ?? autoPlay;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: !unloadOnExit,
    threshold: 0.01,
    rootMargin: "200px",
    skip: priority || !lazy,
  });

  // Load/unload based on viewport
  React.useEffect(() => {
    if (inView && !shouldLoad) {
      setShouldLoad(true);
    }
    if (!inView && unloadOnExit && shouldLoad && !priority) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      setIsLoaded(false);
      setShouldLoad(false);
    }
  }, [inView, shouldLoad, unloadOnExit, priority]);

  // Reset state when URL changes
  React.useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [url]);

  const handleLoadedData = React.useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = React.useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Autoplay on visible / pause on exit
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad || (!autoPlayOnVisible && !autoPlay)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (video.paused) {
              video.play().catch(() => {});
            }
          } else if (!video.paused) {
            video.pause();
          }
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlayOnVisible, autoPlay, shouldLoad]);

  // Fullscreen
  const requestFullscreen = React.useCallback(() => {
    if (!enableFullscreen) return;
    const el = videoRef.current as HTMLVideoElement & {
      webkitRequestFullscreen?: () => void;
      mozRequestFullScreen?: () => void;
      msRequestFullscreen?: () => void;
    };
    if (!el) return;
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (typeof fn === "function") {
      try { fn.call(el); } catch { /* ignore */ }
    }
  }, [enableFullscreen]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableFullscreen) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        requestFullscreen();
      }
    },
    [enableFullscreen, requestFullscreen]
  );

  if (hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={className}>
        <div className="mv-video-error">
          <p>Failed to load video</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={inViewRef}
      className={className}
      role={enableFullscreen ? "button" : undefined}
      tabIndex={enableFullscreen ? 0 : undefined}
      aria-label={enableFullscreen ? "Open video fullscreen" : undefined}
      onDoubleClick={requestFullscreen}
      onKeyDown={onKeyDown}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", outline: "none" }}
    >
      {showSkeleton && !isLoaded && shouldLoad && (
        <Skeleton style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      )}
      {shouldLoad && (
        <video
          ref={videoRef}
          src={url}
          className={mediaClassName}
          controls={controls}
          autoPlay={autoPlay}
          muted={resolvedMuted}
          loop={loop}
          poster={posterUrl}
          onLoadedData={handleLoadedData}
          onError={handleError}
          preload={priority ? "auto" : preload}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 300ms ease",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
            WebkitTapHighlightColor: "transparent",
          } as React.CSSProperties}
        />
      )}
    </div>
  );
}
