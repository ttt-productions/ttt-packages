import * as React from "react";
import type { MediaViewerBaseProps } from "./types";

type AudioViewerProps = MediaViewerBaseProps & {
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
};

export function AudioViewer(props: AudioViewerProps) {
  const {
    url,
    className,
    mediaClassName,
    controls = true,
    autoPlay,
    loop,
  } = props;

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const togglePlay = React.useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, []);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    },
    [togglePlay]
  );

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label="Toggle audio playback"
      onClick={togglePlay}
      onKeyDown={onKeyDown}
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
