import * as React from 'react';
import { getSimplifiedMediaType } from '@ttt-productions/media-schemas';
import type { SimplifiedMediaType } from '@ttt-productions/media-schemas';

import type { MediaViewerType, FallbackMode } from '../types.js';
import type { MediaPreviewProps } from './types.js';
import {
  MediaFallbackLink,
  shouldShowFallback,
  EmptyFallback,
  ErrorFallback,
  PendingFallback,
} from './fallback.js';
import { ImageViewer } from './image-viewer.js';
import { VideoViewer } from './video-viewer.js';
import { AudioViewer } from './audio-viewer.js';
import { useMediaRecovery } from './use-media-recovery.js';
import type { RecoveryState } from '../recovery.js';

function inferType(props: {
  type?: MediaPreviewProps['type'];
  mime?: string;
  name?: string;
  url?: string;
}): MediaViewerType {
  if (props.type) {
    const primary = typeof props.type === 'string' ? props.type.split('/')[0] : props.type;
    if (primary === 'image' || primary === 'video' || primary === 'audio') return primary;
    if (primary === 'other') return 'other';
  }

  const hint = props.mime ?? props.name ?? props.url;
  if (!hint) return 'other';
  const simplified: SimplifiedMediaType = getSimplifiedMediaType(hint);
  return simplified;
}

function RecoveryOverlay({
  state,
  onManualRetry,
  isCircular,
}: {
  state: RecoveryState;
  onManualRetry: () => void;
  isCircular?: boolean;
}) {
  const wrapStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: '0.5rem',
    ...(isCircular ? { borderRadius: '50%' } : {}),
  };

  if (state.phase === 'processing') {
    return (
      <div className="mv-recovery-processing" style={wrapStyle}>
        <span className="mv-recovery-label">Processing media&hellip;</span>
      </div>
    );
  }

  if (state.phase === 'finalizing') {
    return (
      <div className="mv-recovery-finalizing" style={wrapStyle}>
        <span className="mv-recovery-label">Finishing media&hellip;</span>
      </div>
    );
  }

  if (state.phase === 'transient-retry' || state.phase === 'propagating') {
    return (
      <div className="mv-recovery-retrying" style={wrapStyle}>
        <span className="mv-recovery-label">Loading&hellip;</span>
      </div>
    );
  }

  if (state.phase === 'auth-retry') {
    return (
      <div className="mv-recovery-auth" style={wrapStyle}>
        <span className="mv-recovery-label">Refreshing access&hellip;</span>
      </div>
    );
  }

  if (state.phase === 'hard-unavailable') {
    return (
      <div className="mv-recovery-hard" style={wrapStyle}>
        <ErrorFallback isCircular={isCircular} />
        {state.reason === 'auth' ? (
          <span className="mv-recovery-label">Access denied.</span>
        ) : (
          <span className="mv-recovery-label">Media unavailable.</span>
        )}
      </div>
    );
  }

  if (state.phase === 'max-wait-fallback') {
    return (
      <div className="mv-recovery-max-wait" style={wrapStyle}>
        <span className="mv-recovery-label">This media is taking longer than expected.</span>
        <button type="button" className="mv-recovery-retry-btn" onClick={onManualRetry}>
          Retry
        </button>
      </div>
    );
  }

  return null;
}

export function MediaPreview(props: MediaPreviewProps) {
  const {
    url,
    alt,
    type,
    className,
    unloadOnExit,
    urlPending = false,
    isCircular = false,
    enableZoom,
    priority,
    skeleton,
    lazy,
    controls,
    autoPlay,
    muted,
    loop,
    posterUrl,
    preload,
    autoPlayOnVisible,
    onLoad,
    onError,
    onLoadChange,
    onEnded,
    onProgressSample,
    startAtSeconds,
    endOverlay,
    playbackControlsRef,
    audioVisualizerMode,
    audioPersistKey,
    audioExtraActions,
    audioCrossOrigin,
    fallbackMode = 'link',
    fallbackLabel,
    filename,
    mime,
    name,
    recoveryAdapter,
    assetStatusHint,
    loadTimeoutMs,
    placeholder,
  } = props;

  const [hasError, setHasError] = React.useState(false);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);

  const [remountKey, setRemountKey] = React.useState(0);

  const handleRemount = React.useCallback(() => {
    setHasError(false);
    setRemountKey((k) => k + 1);
  }, []);

  const listensForVisibility = recoveryAdapter !== undefined && hasError;
  const [elementVisible, setElementVisible] = React.useState(true);
  const [listenedLastRender, setListenedLastRender] = React.useState(listensForVisibility);
  if (listenedLastRender !== listensForVisibility) {
    setListenedLastRender(listensForVisibility);
    setElementVisible(true);
  }

  const { recoveryState, onMediaError, onMediaLoad, manualRetry } = useMediaRecovery({
    url: typeof url === 'string' ? url : null,
    adapter: recoveryAdapter,
    isElementVisible: elementVisible,
    statusHint: assetStatusHint,
    onRemount: handleRemount,
  });
  const onVisibilityChange = listensForVisibility ? setElementVisible : undefined;

  React.useEffect(() => {
    setHasError(false);
    let objectUrl: string | null = null;

    if (typeof url === 'string') {
      setSourceUrl(url);
    } else if (url instanceof Blob) {
      objectUrl = URL.createObjectURL(url);
      setSourceUrl(objectUrl);
    } else {
      setSourceUrl(null);
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  const handleError = React.useCallback(() => {
    setHasError(true);
    onError?.();
    if (recoveryAdapter) {
      onMediaError();
    }
  }, [onError, recoveryAdapter, onMediaError]);

  const handleLoad = React.useCallback(() => {
    setHasError(false);
    onLoad?.();
    if (recoveryAdapter) {
      onMediaLoad();
    }
  }, [onLoad, recoveryAdapter, onMediaLoad]);

  const circularStyle: React.CSSProperties = isCircular
    ? { borderRadius: '50%', overflow: 'hidden' }
    : {};

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    ...circularStyle,
  };

  const isInRecovery =
    recoveryAdapter !== undefined &&
    recoveryState.phase !== 'idle' &&
    recoveryState.phase !== 'loaded' &&
    recoveryState.phase !== 'loading';

  if (!sourceUrl) {
    return (
      <div className={className} style={wrapperStyle}>
        {placeholder !== undefined ? (
          placeholder
        ) : urlPending ? (
          <PendingFallback isCircular={isCircular} />
        ) : (
          <EmptyFallback isCircular={isCircular} />
        )}
      </div>
    );
  }

  const recoveryOverlay =
    isInRecovery && hasError ? (
      placeholder !== undefined ? (
        placeholder
      ) : (
        <RecoveryOverlay
          state={recoveryState}
          onManualRetry={manualRetry}
          isCircular={isCircular}
        />
      )
    ) : null;
  const errorFallback = placeholder ?? <ErrorFallback isCircular={isCircular} />;

  if (hasError && !recoveryAdapter) {
    return (
      <div className={className} style={wrapperStyle}>
        {errorFallback}
      </div>
    );
  }

  const t = inferType({ type, mime, name, url: sourceUrl });

  if (t === 'image') {
    return (
      <div className={className} style={wrapperStyle}>
        <ImageViewer
          key={remountKey}
          url={sourceUrl}
          alt={alt}
          lazy={lazy}
          priority={priority}
          skeleton={skeleton}
          unloadOnExit={unloadOnExit}
          isCircular={isCircular}
          enableZoom={enableZoom}
          loadTimeoutMs={loadTimeoutMs}
          onLoad={handleLoad}
          onError={handleError}
          onVisibilityChange={onVisibilityChange}
          fallback={recoveryOverlay ?? errorFallback}
          loadingPlaceholder={placeholder}
        />
      </div>
    );
  }

  if (t === 'video') {
    return (
      <div className={className} style={wrapperStyle}>
        <VideoViewer
          key={remountKey}
          url={sourceUrl}
          lazy={lazy}
          priority={priority}
          skeleton={skeleton}
          unloadOnExit={unloadOnExit}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          posterUrl={posterUrl}
          preload={preload}
          autoPlayOnVisible={autoPlayOnVisible}
          loadTimeoutMs={loadTimeoutMs}
          onLoad={handleLoad}
          onError={handleError}
          onVisibilityChange={onVisibilityChange}
          fallback={recoveryOverlay ?? undefined}
          onEnded={onEnded}
          onProgressSample={onProgressSample}
          startAtSeconds={startAtSeconds}
          endOverlay={endOverlay}
          playbackControlsRef={playbackControlsRef}
        />
      </div>
    );
  }

  if (t === 'audio') {
    return (
      <div className={className} style={wrapperStyle}>
        <AudioViewer
          key={remountKey}
          url={sourceUrl}
          lazy={lazy}
          priority={priority}
          skeleton={skeleton}
          autoPlay={autoPlay}
          loop={loop}
          preload={preload}
          visualizerMode={audioVisualizerMode}
          persistKey={audioPersistKey}
          extraActions={audioExtraActions}
          crossOrigin={audioCrossOrigin}
          loadTimeoutMs={loadTimeoutMs}
          onLoad={handleLoad}
          onLoadChange={onLoadChange}
          onError={handleError}
          onVisibilityChange={onVisibilityChange}
          fallback={recoveryOverlay ?? undefined}
          onEnded={onEnded}
          onProgressSample={onProgressSample}
          startAtSeconds={startAtSeconds}
          endOverlay={endOverlay}
          playbackControlsRef={playbackControlsRef}
        />
      </div>
    );
  }

  return shouldShowFallback(fallbackMode as FallbackMode) ? (
    <div className={className} style={wrapperStyle}>
      <MediaFallbackLink url={sourceUrl} filename={filename} label={fallbackLabel ?? 'Download'} />
    </div>
  ) : null;
}
