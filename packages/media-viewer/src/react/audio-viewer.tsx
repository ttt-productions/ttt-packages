import * as React from 'react';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from '@ttt-productions/ui-core/react';
import type { AudioViewerProps } from './types.js';
import { useMediaPlayback } from './use-media-playback.js';
import { AudioPlayerChrome } from './audio-player-chrome.js';
import { useLoadWatchdog } from './use-load-watchdog.js';

export function AudioViewer(props: AudioViewerProps) {
  const {
    url,
    className,
    mediaClassName,
    autoPlay,
    loop = false,
    lazy = true,
    skeleton: showSkeleton = true,
    priority = false,
    preload = 'metadata',
    onLoad,
    onLoadChange,
    onError,
    onVisibilityChange,
    fallback,
    loadTimeoutMs,
    onEnded,
    onProgressSample,
    startAtSeconds,
    endOverlay,
    playbackControlsRef,
    visualizerMode,
    persistKey,
    extraActions,
    crossOrigin,
  } = props;

  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(priority || !lazy);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const loadReportedRef = React.useRef(false);

  const {
    hasEnded,
    handlers: playbackHandlers,
    attachElement,
  } = useMediaPlayback(
    audioRef,
    { onEnded, onProgressSample, startAtSeconds, endOverlay },
    playbackControlsRef,
    url,
  );

  const setAudioRef = React.useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      attachElement(el);
    },
    [attachElement],
  );

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: false,
    threshold: 0.01,
    skip: priority || (shouldLoad && !onVisibilityChange),
    rootMargin: '100px',
    onChange: (visible) => onVisibilityChange?.(visible),
  });

  React.useEffect(() => {
    if (inView && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [inView, shouldLoad]);

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
    loadReportedRef.current = false;
  }, [url]);

  // A preload="metadata" element may not fire loadeddata or canplay until play.
  const reveal = React.useCallback(() => {
    setIsLoaded(true);
    if (loadReportedRef.current) return;
    loadReportedRef.current = true;
    onLoad?.();
  }, [onLoad]);

  const handleError = React.useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  }, [onError]);

  const handleLoadedMetadata = React.useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      reveal();
      playbackHandlers.onLoadedMetadata(e);
    },
    [reveal, playbackHandlers],
  );

  useLoadWatchdog(shouldLoad && !isLoaded && !hasError, loadTimeoutMs, handleError);

  if (hasError) {
    return (
      <div
        ref={inViewRef}
        className={className}
        style={fallback ? { position: 'relative', width: '100%', height: '100%' } : undefined}
      >
        {fallback ?? (
          <div className="mv-audio-error">
            <p>Failed to load audio</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={inViewRef}
      className={className}
      style={{ position: 'relative', width: '100%', outline: 'none' }}
    >
      {!shouldLoad ? (
        showSkeleton ? (
          <Skeleton style={{ height: '3.5rem', width: '100%' }} />
        ) : null
      ) : (
        <>
          {showSkeleton && !isLoaded && (
            <Skeleton style={{ position: 'absolute', inset: 0, height: '3.5rem', width: '100%' }} />
          )}
          <audio
            ref={setAudioRef}
            src={url}
            crossOrigin={crossOrigin}
            className={mediaClassName}
            controls={false}
            autoPlay={autoPlay}
            loop={loop}
            preload={preload}
            onLoadedData={reveal}
            onCanPlay={reveal}
            onError={handleError}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={playbackHandlers.onTimeUpdate}
            onPlay={playbackHandlers.onPlay}
            onPause={playbackHandlers.onPause}
            onSeeked={playbackHandlers.onSeeked}
            onEnded={playbackHandlers.onEnded}
            style={{
              width: '100%',
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity var(--motion-slow) var(--motion-ease)',
            }}
          />
          <AudioPlayerChrome
            audioRef={audioRef}
            visualizerMode={visualizerMode}
            persistKey={persistKey}
            extraActions={extraActions}
          />
          {endOverlay != null && hasEnded && (
            <div className="mv-end-overlay" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
              {endOverlay}
            </div>
          )}
        </>
      )}
    </div>
  );
}
