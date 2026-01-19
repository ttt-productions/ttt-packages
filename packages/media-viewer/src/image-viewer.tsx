import * as React from "react";
import type { MediaViewerBaseProps } from "./types";

type ImageViewerProps = MediaViewerBaseProps & {
  enableZoom?: boolean;
};

export function ImageViewer(props: ImageViewerProps) {
  const {
    url,
    alt,
    className,
    mediaClassName,
    enableZoom = true,
  } = props;

  const [zoomed, setZoomed] = React.useState(false);

  const toggleZoom = React.useCallback(() => {
    if (!enableZoom) return;
    setZoomed((z) => !z);
  }, [enableZoom]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableZoom) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleZoom();
      }
    },
    [enableZoom, toggleZoom]
  );

  return (
    <div
      className={className}
      role={enableZoom ? "button" : undefined}
      tabIndex={enableZoom ? 0 : undefined}
      aria-pressed={enableZoom ? zoomed : undefined}
      aria-label={enableZoom ? (zoomed ? "Zoom out image" : "Zoom in image") : undefined}
      onClick={toggleZoom}
      onKeyDown={onKeyDown}
      style={{ outline: "none" }}
    >
      <img
        src={url}
        alt={alt ?? ""}
        draggable={false}
        className={mediaClassName}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          transition: "transform 0.15s ease",
          transform: zoomed ? "scale(1.5)" : "scale(1)",
          cursor: enableZoom ? (zoomed ? "zoom-out" : "zoom-in") : undefined,
        }}
      />
    </div>
  );
}
