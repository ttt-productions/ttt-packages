import * as React from "react";
import { useInView } from "react-intersection-observer";
import { Skeleton } from "@ttt-productions/ui-core";
import type { AudioViewerProps } from "./types";

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
  } = props;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: false,
    threshold: 0.01,
    skip: priority || shouldLoad,
    rootMargin: "100px",
  });

  // Load when in view
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

  // Report loading state
  React.useEffect(() => {
    onLoadChange?.(!isLoaded);
  }, [isLoaded, onLoadChange]);

  // Reset on URL change
  React.useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
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

  // Tap-to-toggle when controls are off
  const togglePlay = React.useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, []);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (controls) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    },
    [controls, togglePlay]
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
      role={controls ? undefined : "button"}
      tabIndex={controls ? undefined : 0}
      aria-label={controls ? undefined : "Toggle audio playback"}
      onClick={controls ? undefined : togglePlay}
      onKeyDown={controls ? undefined : onKeyDown}
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
            controls={controls}
            autoPlay={autoPlay}
            loop={loop}
            preload={preload}
            onLoadedData={handleLoadedData}
            onCanPlay={handleCanPlay}
            onError={handleError}
            style={{
              width: "100%",
              opacity: isLoaded ? 1 : 0,
              transition: "opacity 300ms ease",
            }}
          />
        </>
      )}
    </div>
  );
}
