
import type { MediaViewerBaseProps } from "./types";

export function MediaFallbackLink(props: {
  url: string;
  filename?: string;
  className?: string;
  label?: string;
}) {
  const { url, filename, className, label } = props;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename || undefined}
      className={className}
    >
      {label ?? "Download"}
    </a>
  );
}

export function shouldShowFallback(mode: MediaViewerBaseProps["fallbackMode"]): boolean {
  return mode !== "none";
}
