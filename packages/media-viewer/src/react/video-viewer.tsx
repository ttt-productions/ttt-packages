import * as React from "react";
import { useInView } from "react-intersection-observer";
import { Skeleton } from "@ttt-productions/ui-core/react";
import type { VideoViewerProps } from "../types.js";
import { useMediaPlayback } from "./use-media-playback.js";

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
    onEnded,
    onProgressSample,
    startAtSeconds,
    endOverlay,
    playbackControlsRef,
  } = props;

  const resolvedMuted = muted ?? autoPlay;
  const autoplayActive = autoPlayOnVisible || autoPlay;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Additive playback API (onEnded, progress sampling, startAt/resume,
  // endOverlay, imperative controls). Derives everything from element events —
  // adds no observer (Rule 22).
  const { hasEnded, handlers: playbackHandlers } = useMediaPlayback(
    videoRef,
    { onEnded, onProgressSample, startAtSeconds, endOverlay },
    playbackControlsRef,
    url,
  );

  // Single observer for both lazy-load gating AND autoplay-on-visible.
  // threshold: [0, 0.5] — 0 fires "any pixel visible" (drives shouldLoad),
  // 0.5 fires "at least half visible" (drives autoplay/pause).
  const { ref: inViewRef, inView, entry } = useInView({
    triggerOnce: !unloadOnExit && !autoplayActive,
    threshold: [0, 0.5],
    rootMargin: "200px",
    skip: !autoplayActive && (priority || !lazy),
  });

  const isFullyVisible = (entry?.intersectionRatio ?? 0) >= 0.5;

  React.useEffect(() => {
    if (inView && !shouldLoad) {
      setShouldLoad(true);
    }
    if (!inView && unloadOnExit && shouldLoad && !priority && lazy) {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      setIsLoaded(false);
      setShouldLoad(false);
    }
  }, [inView, shouldLoad, unloadOnExit, priority, lazy]);

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

  // Autoplay on >=50% visible / pause when below (same single observer above)
  React.useEffect(() => {
    if (!autoplayActive) return;
    const video = videoRef.current;
    if (!video || !shouldLoad) return;
    if (isFullyVisible) {
      if (video.paused) {
        video.play().catch(() => {});
      }
    } else if (!video.paused) {
      video.pause();
    }
  }, [autoplayActive, shouldLoad, isFullyVisible]);

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
          onLoadedMetadata={playbackHandlers.onLoadedMetadata}
          onTimeUpdate={playbackHandlers.onTimeUpdate}
          onPlay={playbackHandlers.onPlay}
          onPause={playbackHandlers.onPause}
          onSeeked={playbackHandlers.onSeeked}
          onEnded={playbackHandlers.onEnded}
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
      {endOverlay != null && hasEnded && (
        <div
          className="mv-end-overlay"
          style={{ position: "absolute", inset: 0, zIndex: 2 }}
        >
          {endOverlay}
        </div>
      )}
    </div>
  );
}
