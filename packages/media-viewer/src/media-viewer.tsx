import { getSimplifiedMediaType } from "@ttt-productions/media-contracts";
import type { SimplifiedMediaType } from "@ttt-productions/media-contracts";

import type { MediaViewerBaseProps, MediaViewerType } from "./types";
import { MediaFallbackLink, shouldShowFallback } from "./fallback";
import { ImageViewer } from "./image-viewer";
import { VideoViewer } from "./video-viewer";
import { AudioViewer } from "./audio-viewer";

function inferType(props: Pick<MediaViewerBaseProps, "type" | "mime" | "name" | "url">): MediaViewerType {
  if (props.type) return props.type;

  const hint = props.mime ?? props.name ?? props.url;
  const simplified: SimplifiedMediaType = getSimplifiedMediaType(hint);
  return simplified;
}

export function MediaViewer(props: MediaViewerBaseProps) {
  const {
    url,
    className,
    filename,
    fallbackMode = "link",
    fallbackLabel
  } = props;

  const t = inferType(props);

  if (t === "image") return <ImageViewer {...props} type="image" />;
  if (t === "video") return <VideoViewer {...props} type="video" />;
  if (t === "audio") return <AudioViewer {...props} type="audio" />;

  // future: pdf
  // if (t === "pdf") ...

  return shouldShowFallback(fallbackMode) ? (
    <div className={className}>
      <MediaFallbackLink
        url={url}
        filename={filename}
        label={fallbackLabel ?? "Download"}
      />
    </div>
  ) : null;
}

/** Back-compat alias */
export const MediaPreview = MediaViewer;
