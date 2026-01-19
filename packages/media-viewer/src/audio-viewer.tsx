import * as React from "react";
import type { MediaViewerBaseProps } from "./types";
import { MediaFallbackLink, shouldShowFallback } from "./fallback";

function withCacheBust(url: string, nonce: number): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}mv_retry=${nonce}`;
}

export function AudioViewer(props: MediaViewerBaseProps) {
  const {
    url,
    className,
    mediaClassName,
    onError,
    onLoad,
    fallbackMode = "link",
    fallbackLabel,
    ariaLabel,
    showLoading = true,
    loadingFallback,
    retryLabel,
    showDownload,
    downloadLabel,
    filename,
  } = props;

  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [retryNonce, setRetryNonce] = React.useState(0);

  const effectiveUrl = withCacheBust(url, retryNonce);

  const retry = React.useCallback(() => {
    setFailed(false);
    setLoaded(false);
    setRetryNonce((n) => n + 1);
  }, []);

  if (failed) {
    return shouldShowFallback(fallbackMode) ? (
      <div className={className}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <MediaFallbackLink url={url} filename={filename} label={fallbackLabel ?? "Open audio"} />
          <button type="button" onClick={retry} aria-label={retryLabel ?? "Retry"}>
            {retryLabel ?? "Retry"}
          </button>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={className}>
      {showDownload ? (
        <div style={{ marginBottom: 8 }}>
          <MediaFallbackLink url={url} filename={filename} label={downloadLabel ?? "Download"} />
        </div>
      ) : null}

      {showLoading && !loaded ? loadingFallback ?? <div aria-busy="true">Loading…</div> : null}

      <audio
        src={effectiveUrl}
        className={mediaClassName}
        controls
        preload="metadata"
        aria-label={ariaLabel}
        onLoadedData={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
      />
    </div>
  );
}
