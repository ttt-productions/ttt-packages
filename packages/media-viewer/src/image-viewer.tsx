import * as React from "react";
import type { MediaViewerBaseProps } from "./types";
import { MediaFallbackLink, shouldShowFallback } from "./fallback";

function canFullscreen(el: any): el is { requestFullscreen: () => Promise<void> } {
  return !!el?.requestFullscreen;
}

function withCacheBust(url: string, nonce: number): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}mv_retry=${nonce}`;
}

export function ImageViewer(props: MediaViewerBaseProps) {
  const {
    url,
    alt,
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
    enableImageZoom,
    enableFullscreen,
    filename,
  } = props;

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [retryNonce, setRetryNonce] = React.useState(0);
  const [zoomed, setZoomed] = React.useState(false);

  const effectiveUrl = withCacheBust(url, retryNonce);

  const retry = React.useCallback(() => {
    setFailed(false);
    setLoaded(false);
    setRetryNonce((n) => n + 1);
  }, []);

  const requestFs = React.useCallback(() => {
    if (!enableFullscreen) return;
    const el = wrapperRef.current;
    if (canFullscreen(el)) el.requestFullscreen().catch(() => {});
  }, [enableFullscreen]);

  if (failed) {
    return shouldShowFallback(fallbackMode) ? (
      <div className={className}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <MediaFallbackLink url={url} filename={filename} label={fallbackLabel ?? "Open image"} />
          <button type="button" onClick={retry} aria-label={retryLabel ?? "Retry"}>
            {retryLabel ?? "Retry"}
          </button>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={className} ref={wrapperRef}>
      {showDownload ? (
        <div style={{ marginBottom: 8 }}>
          <MediaFallbackLink url={url} filename={filename} label={downloadLabel ?? "Download"} />
        </div>
      ) : null}

      {showLoading && !loaded ? (
        loadingFallback ?? <div aria-busy="true">Loading…</div>
      ) : null}

      <img
        src={effectiveUrl}
        alt={alt ?? ""}
        aria-label={ariaLabel}
        loading="lazy"
        decoding="async"
        className={mediaClassName}
        style={
          enableImageZoom && zoomed
            ? { transform: "scale(1.5)", transformOrigin: "center", cursor: "zoom-out" }
            : enableImageZoom
              ? { cursor: "zoom-in" }
              : undefined
        }
        onClick={() => {
          if (enableImageZoom) setZoomed((z) => !z);
        }}
        onError={(e) => {
          setFailed(true);
          onError?.(e);
        }}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />

      {enableFullscreen ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={requestFs} aria-label="Fullscreen">
            Fullscreen
          </button>
        </div>
      ) : null}
    </div>
  );
}
