import * as React from "react";
import type { MediaViewerProps } from "./types";

export function AudioViewer(props: MediaViewerProps) {
  const {
    url,
    className,
    mediaClassName,
    controls = true,
    autoPlay,
    loop,
  } = props;

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Only add "tap-to-toggle" when controls are OFF (prevents jank)
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

  return (
    <div
      className={className}
      role={controls ? undefined : "button"}
      tabIndex={controls ? undefined : 0}
      aria-label={controls ? undefined : "Toggle audio playback"}
      onClick={controls ? undefined : togglePlay}
      onKeyDown={controls ? undefined : onKeyDown}
      style={{ outline: "none" }}
    >
      <audio
        ref={audioRef}
        src={url}
        className={mediaClassName}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
      />
    </div>
  );
}
