import * as React from "react";
import type { MediaViewerProps } from "./types";

export function VideoViewer(props: MediaViewerProps) {
  const {
    url,
    className,
    mediaClassName,
    controls = true,
    autoPlay,
    muted,
    loop,
    posterUrl,
    enableFullscreen = true,
  } = props;

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const requestFullscreen = React.useCallback(() => {
    if (!enableFullscreen) return;
    const el = videoRef.current as any;
    if (!el) return;

    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;

    if (typeof fn === "function") {
      try {
        fn.call(el);
      } catch {
        // ignore
      }
    }
  }, [enableFullscreen]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableFullscreen) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        requestFullscreen();
      }
    },
    [enableFullscreen, requestFullscreen]
  );

  return (
    <div
      className={className}
      role={enableFullscreen ? "button" : undefined}
      tabIndex={enableFullscreen ? 0 : undefined}
      aria-label={enableFullscreen ? "Open video fullscreen" : undefined}
      onDoubleClick={requestFullscreen}
      onKeyDown={onKeyDown}
      style={{ outline: "none" }}
    >
      <video
        ref={videoRef}
        src={url}
        className={mediaClassName}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline
        poster={posterUrl}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
