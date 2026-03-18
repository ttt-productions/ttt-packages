import * as React from "react";
import { getSimplifiedMediaType } from "@ttt-productions/media-contracts";
import type { SimplifiedMediaType } from "@ttt-productions/media-contracts";

import type { MediaPreviewProps, MediaViewerType, FallbackMode } from "./types";
import { MediaFallbackLink, shouldShowFallback, EmptyFallback, ErrorFallback } from "./fallback";
import { ImageViewer } from "./image-viewer";
import { VideoViewer } from "./video-viewer";
import { AudioViewer } from "./audio-viewer";

function inferType(props: { type?: MediaPreviewProps["type"]; mime?: string; name?: string; url?: string }): MediaViewerType {
  if (props.type) {
    // Handle MIME strings like "image/png" -> "image"
    const primary = typeof props.type === "string" ? props.type.split("/")[0] : props.type;
    if (primary === "image" || primary === "video" || primary === "audio") return primary;
    if (primary === "other") return "other";
  }

  const hint = props.mime ?? props.name ?? props.url;
  if (!hint) return "other";
  const simplified: SimplifiedMediaType = getSimplifiedMediaType(hint);
  return simplified;
}

export function MediaViewer(props: MediaPreviewProps) {
  const {
    url,
    alt,
    type,
    className,
    unloadOnExit,
    isCircular = false,
    priority,
    skeleton,
    lazy,
    controls,
    autoPlay,
    muted,
    loop,
    posterUrl,
    preload,
    onLoad,
    onError,
    onLoadChange,
    fallbackMode = "link",
    fallbackLabel,
    filename,
    mime,
    name,
  } = props;

  const [hasError, setHasError] = React.useState(false);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);

  // Handle string / Blob / File / null URLs
  React.useEffect(() => {
    setHasError(false);
    let objectUrl: string | null = null;

    if (typeof url === "string") {
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
  }, [onError]);

  const circularStyle: React.CSSProperties = isCircular
    ? { borderRadius: "50%", overflow: "hidden" }
    : {};

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    ...circularStyle,
  };

  // No URL -> empty fallback
  if (!sourceUrl) {
    return (
      <div className={className} style={wrapperStyle}>
        <EmptyFallback isCircular={isCircular} />
      </div>
    );
  }

  // Error -> error fallback
  if (hasError) {
    return (
      <div className={className} style={wrapperStyle}>
        <ErrorFallback isCircular={isCircular} />
      </div>
    );
  }

  const t = inferType({ type, mime, name, url: sourceUrl });

  if (t === "image") {
    return (
      <div className={className} style={wrapperStyle}>
        <ImageViewer
          url={sourceUrl}
          alt={alt}
          lazy={lazy}
          priority={priority}
          skeleton={skeleton}
          unloadOnExit={unloadOnExit}
          isCircular={isCircular}
          onLoad={onLoad}
          onError={handleError}
          fallback={<ErrorFallback isCircular={isCircular} />}
        />
      </div>
    );
  }

  if (t === "video") {
    return (
      <div className={className} style={wrapperStyle}>
        <VideoViewer
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
          onLoad={onLoad}
          onError={handleError}
        />
      </div>
    );
  }

  if (t === "audio") {
    return (
      <div className={className} style={wrapperStyle}>
        <AudioViewer
          url={sourceUrl}
          lazy={lazy}
          priority={priority}
          skeleton={skeleton}
          controls={controls}
          autoPlay={autoPlay}
          loop={loop}
          preload={preload}
          onLoad={onLoad}
          onLoadChange={onLoadChange}
          onError={handleError}
        />
      </div>
    );
  }

  // Unknown type -> fallback link
  return shouldShowFallback(fallbackMode as FallbackMode) ? (
    <div className={className} style={wrapperStyle}>
      <MediaFallbackLink url={sourceUrl} filename={filename} label={fallbackLabel ?? "Download"} />
    </div>
  ) : null;
}

/** Back-compat alias */
export const MediaPreview = MediaViewer;
