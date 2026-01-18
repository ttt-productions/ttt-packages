"use client";

import type { MediaProcessingSpec } from "@ttt-productions/media-contracts";
import { Badge, Card, cn } from "@ttt-productions/ui-core";

export interface MediaConstraintsHintProps {
  spec: MediaProcessingSpec;
  className?: string;
  title?: string;
}

function fmtBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${Math.round(mb)}MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)}GB`;
}

function fmtAspect(x?: number) {
  if (!x) return null;
  // show common approx ratios if close
  const candidates: Array<[string, number]> = [
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["3:4", 3 / 4],
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
  ];
  for (const [label, v] of candidates) {
    if (Math.abs(x - v) <= 0.02) return label;
  }
  return `${x.toFixed(3)}`;
}

export function MediaConstraintsHint(props: MediaConstraintsHintProps) {
  const { spec, className, title = "Upload requirements" } = props;

  const acceptKinds = spec.accept?.kinds?.length ? spec.accept.kinds.join(", ") : "any";
  const acceptMimes = spec.accept?.mimes?.length ? spec.accept.mimes.join(", ") : "any";

  const maxBytes = fmtBytes(spec.maxBytes);
  const maxDur =
    spec.maxDurationSec ?? spec.video?.maxDurationSec ?? spec.audio?.maxDurationSec ?? undefined;

  const requiredAspect = fmtAspect(spec.requiredAspectRatio ?? spec.imageCrop?.aspectRatio);
  const requiredDims =
    spec.requiredWidth && spec.requiredHeight ? `${spec.requiredWidth}×${spec.requiredHeight}` : null;

  const videoOri = spec.videoOrientation && spec.videoOrientation !== "any" ? spec.videoOrientation : null;

  const cropDims =
    spec.imageCrop ? `${spec.imageCrop.outputWidth}×${spec.imageCrop.outputHeight}` : null;

  const willAutoFormat = !!spec.allowAutoFormat;

  const items: Array<{ k: string; v: string | null }> = [
    { k: "Kind", v: acceptKinds },
    { k: "Types", v: acceptMimes },
    { k: "Max size", v: maxBytes },
    { k: "Max length", v: maxDur ? `${maxDur}s` : null },
    { k: "Orientation", v: videoOri },
    { k: "Aspect", v: requiredAspect },
    { k: "Exact size", v: requiredDims },
    { k: "Crop output", v: cropDims },
    { k: "Auto-format", v: willAutoFormat ? "yes" : null },
  ].filter((x) => x.v);

  if (!items.length) return null;

  return (
    <Card className={cn("p-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {willAutoFormat ? <Badge variant="secondary">Auto-format supported</Badge> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <Badge key={it.k} variant="outline" className="gap-1">
            <span className="text-muted-foreground">{it.k}:</span>
            <span>{it.v}</span>
          </Badge>
        ))}
      </div>

      {spec.imageCrop ? (
        <div className="mt-2 text-xs text-muted-foreground">
          Images will be cropped to {fmtAspect(spec.imageCrop.aspectRatio)} and exported as{" "}
          {(spec.imageCrop.format ?? "jpeg").toUpperCase()}
          {spec.imageCrop.quality ? ` @ ${spec.imageCrop.quality}%` : ""}.
        </div>
      ) : null}

      {spec.allowAutoFormat ? (
        <div className="mt-2 text-xs text-muted-foreground">
          If your video doesn’t match the format, we’ll ask before uploading and then auto-format it in processing.
        </div>
      ) : null}
    </Card>
  );
}
