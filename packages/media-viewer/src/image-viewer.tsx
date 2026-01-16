import * as React from "react";
import type { MediaViewerBaseProps } from "./types";
import { MediaFallbackLink, shouldShowFallback } from "./fallback";

export function ImageViewer(props: MediaViewerBaseProps) {
  const {
    url,
    alt,
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
        <MediaFallbackLink url={url} label={fallbackLabel ?? "Open image"} />
      </div>
    ) : null;
  }

  return (
    <div className={className}>
      <img
        src={url}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className={mediaClassName}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
      />
    </div>
  );
}
