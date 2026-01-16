import * as React from "react";
import type { MediaViewerBaseProps } from "./types";
import { MediaFallbackLink, shouldShowFallback } from "./fallback";

export function VideoViewer(props: MediaViewerBaseProps) {
  const {
    url,
    className,
    mediaClassName,
    onError,
    fallbackMode = "link",
    fallbackLabel
  } = props;

  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return shouldShowFallback(fallbackMode) ? (
      <div className={className}>
        <MediaFallbackLink url={url} label={fallbackLabel ?? "Open video"} />
      </div>
    ) : null;
  }

  return (
    <div className={className}>
      <video
        src={url}
        className={mediaClassName}
        controls
        preload="metadata"
        poster={props.poster}
        playsInline
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
      />
    </div>
  );
}
