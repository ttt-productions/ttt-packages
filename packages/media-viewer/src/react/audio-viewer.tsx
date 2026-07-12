import * as React from "react";
import { useInView } from "react-intersection-observer";
import { Skeleton } from "@ttt-productions/ui-core/react";
import type { AudioViewerProps } from "../types.js";
import { useMediaPlayback } from "./use-media-playback.js";
import { AudioPlayerChrome } from "./audio-player-chrome.js";
import { useLoadWatchdog } from "./use-load-watchdog.js";

export function AudioViewer(props: AudioViewerProps) {
  const {
    url,
    className,
    mediaClassName,
    controls = true,
    autoPlay,
    loop = false,
    lazy = true,
    skeleton: showSkeleton = true,
    priority = false,
    preload = "metadata",
    onLoad,
    onLoadChange,
    onError,
    fallback,
    loadTimeoutMs,
    onEnded,
    onProgressSample,
    startAtSeconds,
    endOverlay,
    playbackControlsRef,
    chrome = "native",
    visualizerMode,
    persistKey,
    extraActions,
  } = props;

  // The custom player chrome owns the control surface — the native strip and
  // the tap-to-toggle container semantics both stand down.
  const isPlayerChrome = chrome === "player";
  const showNativeControls = isPlayerChrome ? false : controls;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [hasMetadata, setHasMetadata] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Additive playback API — derives from element events (no observer, Rule 22).
  const { hasEnded, handlers: playbackHandlers } = useMediaPlayback(
    audioRef,
    { onEnded, onProgressSample, startAtSeconds, endOverlay },
    playbackControlsRef,
    url,
  );

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: false,
    threshold: 0.01,
    skip: priority || shouldLoad,
    rootMargin: "100px",
  });

  React.useEffect(() => {
    if (inView && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [inView, shouldLoad]);

  // Accordion compatibility: delayed auto-load on mount
  React.useEffect(() => {
    if (priority || shouldLoad) return;
    const timer = setTimeout(() => {
      if (!shouldLoad) setShouldLoad(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [url, priority, shouldLoad]);

  React.useEffect(() => {
    onLoadChange?.(!isLoaded);
  }, [isLoaded, onLoadChange]);

  React.useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setHasMetadata(false);
  }, [url]);

  const handleLoadedData = React.useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleCanPlay = React.useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = React.useCallback(() => {
    setHasError(true);
    setIsLoaded(true); // Stop skeleton on error
    onError?.();
  }, [onError]);

  // Watchdog settles on METADATA — preload="metadata" audio may not fire
  // loadeddata/canplay until play, and must not false-positive.
  const handleLoadedMetadata = React.useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setHasMetadata(true);
      playbackHandlers.onLoadedMetadata(e);
    },
    [playbackHandlers]
  );

  useLoadWatchdog(
    shouldLoad && !isLoaded && !hasMetadata && !hasError,
    loadTimeoutMs,
    handleError
  );

  // Tap-to-toggle when controls are off
  const togglePlay = React.useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, []);

  // Tap-to-toggle applies only to the bare controls-less element — with the
  // player chrome there are real buttons, so container semantics stand down.
  const tapToToggle = !showNativeControls && !isPlayerChrome;

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!tapToToggle) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    },
    [tapToToggle, togglePlay]
  );

  if (hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={className}>
        <div className="mv-audio-error">
          <p>Failed to load audio</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={inViewRef}
      className={className}
      role={tapToToggle ? "button" : undefined}
      tabIndex={tapToToggle ? 0 : undefined}
      aria-label={tapToToggle ? "Toggle audio playback" : undefined}
      onClick={tapToToggle ? togglePlay : undefined}
      onKeyDown={tapToToggle ? onKeyDown : undefined}
      style={{ position: "relative", width: "100%", outline: "none" }}
    >
      {!shouldLoad ? (
        showSkeleton ? <Skeleton style={{ height: "3.5rem", width: "100%" }} /> : null
      ) : (
        <>
          {showSkeleton && !isLoaded && (
            <Skeleton style={{ position: "absolute", inset: 0, height: "3.5rem", width: "100%" }} />
          )}
          <audio
            ref={audioRef}
            src={url}
            className={mediaClassName}
            controls={showNativeControls}
            autoPlay={autoPlay}
            loop={loop}
            preload={preload}
            onLoadedData={handleLoadedData}
            onCanPlay={handleCanPlay}
            onError={handleError}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={playbackHandlers.onTimeUpdate}
            onPlay={playbackHandlers.onPlay}
            onPause={playbackHandlers.onPause}
            onSeeked={playbackHandlers.onSeeked}
            onEnded={playbackHandlers.onEnded}
            style={{
              width: "100%",
              opacity: isLoaded ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          />
          {isPlayerChrome && (
            <AudioPlayerChrome
              audioRef={audioRef}
              visualizerMode={visualizerMode}
              persistKey={persistKey}
              extraActions={extraActions}
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
        </>
      )}
    </div>
  );
}
