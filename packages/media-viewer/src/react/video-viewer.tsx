import * as React from 'react';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from '@ttt-productions/ui-core/react';
import type { VideoViewerProps } from './types.js';
import { useMediaPlayback } from './use-media-playback.js';
import { useLoadWatchdog } from './use-load-watchdog.js';

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
    preload = 'metadata',
    autoPlayOnVisible = false,
    onLoad,
    onError,
    onVisibilityChange,
    fallback,
    loadTimeoutMs,
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
  const loadReportedRef = React.useRef(false);

  const {
    hasEnded,
    handlers: playbackHandlers,
    attachElement,
    retireElement,
  } = useMediaPlayback(
    videoRef,
    { onEnded, onProgressSample, startAtSeconds, endOverlay },
    playbackControlsRef,
    url,
  );

  const setVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      attachElement(el);
    },
    [attachElement],
  );

  const {
    ref: inViewRef,
    inView,
    entry,
  } = useInView({
    triggerOnce: !unloadOnExit && !autoplayActive && !onVisibilityChange,
    threshold: [0, 0.5],
    rootMargin: '200px',
    skip: !autoplayActive && (priority || !lazy),
    onChange: (visible) => onVisibilityChange?.(visible),
  });

  const isFullyVisible = (entry?.intersectionRatio ?? 0) >= 0.5;

  React.useEffect(() => {
    if (inView && !shouldLoad) {
      setShouldLoad(true);
    }
    if (!inView && unloadOnExit && shouldLoad && !priority && lazy) {
      const video = videoRef.current;
      if (video) {
        // Retire first: the teardown below makes the element emit pause/seek/reset events.
        retireElement();
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      setIsLoaded(false);
      loadReportedRef.current = false;
      setShouldLoad(false);
    }
  }, [inView, shouldLoad, unloadOnExit, priority, lazy, retireElement]);

  React.useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    loadReportedRef.current = false;
  }, [url]);

  // A preload="metadata" element may not fire loadeddata until play.
  const reveal = React.useCallback(() => {
    setIsLoaded(true);
    if (loadReportedRef.current) return;
    loadReportedRef.current = true;
    onLoad?.();
  }, [onLoad]);

  const handleError = React.useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  const handleLoadedMetadata = React.useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      reveal();
      playbackHandlers.onLoadedMetadata(e);
    },
    [reveal, playbackHandlers],
  );

  useLoadWatchdog(shouldLoad && !isLoaded && !hasError, loadTimeoutMs, handleError);

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
    if (typeof fn === 'function') {
      try {
        fn.call(el);
      } catch {
        // A browser that refuses fullscreen throws, and the control then does nothing.
      }
    }
  }, [enableFullscreen]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableFullscreen) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        requestFullscreen();
      }
    },
    [enableFullscreen, requestFullscreen],
  );

  if (hasError) {
    return (
      <div
        ref={inViewRef}
        className={className}
        style={fallback ? { position: 'relative', width: '100%', height: '100%' } : undefined}
      >
        {fallback ?? (
          <div className="mv-video-error">
            <p>Failed to load video</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={inViewRef}
      className={className}
      role={enableFullscreen ? 'button' : undefined}
      tabIndex={enableFullscreen ? 0 : undefined}
      aria-label={enableFullscreen ? 'Open video fullscreen' : undefined}
      onDoubleClick={requestFullscreen}
      onKeyDown={onKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {showSkeleton && !isLoaded && shouldLoad && (
        <Skeleton style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      )}
      {shouldLoad && (
        <video
          ref={setVideoRef}
          src={url}
          className={mediaClassName}
          controls={controls}
          autoPlay={autoPlay}
          muted={resolvedMuted}
          loop={loop}
          poster={posterUrl}
          onLoadedData={reveal}
          onError={handleError}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={playbackHandlers.onTimeUpdate}
          onPlay={playbackHandlers.onPlay}
          onPause={playbackHandlers.onPause}
          onSeeked={playbackHandlers.onSeeked}
          onEnded={playbackHandlers.onEnded}
          preload={priority ? 'auto' : preload}
          playsInline
          style={
            {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity var(--motion-slow) var(--motion-ease)',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
            } as React.CSSProperties
          }
        />
      )}
      {endOverlay != null && hasEnded && (
        <div className="mv-end-overlay" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          {endOverlay}
        </div>
      )}
    </div>
  );
}
