import { getSimplifiedMediaType } from "@ttt-productions/media-contracts";
import type { MediaKind, VideoOrientation } from "@ttt-productions/media-contracts";

export interface ReadMediaMetaResult {
  kind: MediaKind;
  mime?: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  orientation?: VideoOrientation;
  aspectRatio?: number;
}

function simplifiedToKind(s: ReturnType<typeof getSimplifiedMediaType>): MediaKind {
  if (s === "image" || s === "video" || s === "audio") return s;
  return "file";
}

function computeOrientation(width?: number, height?: number): VideoOrientation | undefined {
  if (!width || !height) return undefined;
  if (width === height) return "any";
  return height > width ? "vertical" : "horizontal";
}

async function readImage(file: File): Promise<Pick<ReadMediaMetaResult, "width" | "height" | "aspectRatio">> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        resolve({ width, height, aspectRatio: height ? width / height : undefined });
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      resolve({});
    };
    img.src = url;
  });
}

async function readAV(
  file: File
): Promise<Pick<ReadMediaMetaResult, "width" | "height" | "durationSec" | "aspectRatio">> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith("video/");
    const el = document.createElement(isVideo ? "video" : "audio");
    el.preload = "metadata";

    const url = URL.createObjectURL(file);

    el.onloadedmetadata = () => {
      try {
        const durationSec = Number.isFinite((el as any).duration) ? (el as any).duration : undefined;
        if (isVideo) {
          const v = el as HTMLVideoElement;
          const width = v.videoWidth || undefined;
          const height = v.videoHeight || undefined;
          resolve({ width, height, durationSec, aspectRatio: height ? width! / height : undefined });
        } else {
          resolve({ durationSec });
        }
      } finally {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    };

    el.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      resolve({});
    };

    el.src = url;
  });
}

export async function readMediaMeta(file: File): Promise<ReadMediaMetaResult> {
  const simplified = getSimplifiedMediaType(file);
  const kind = simplifiedToKind(simplified);

  const base: ReadMediaMetaResult = {
    kind,
    mime: file.type || undefined,
    sizeBytes: file.size,
  };

  if (kind === "image") {
    const img = await readImage(file);
    return {
      ...base,
      ...img,
      orientation: computeOrientation(img.width, img.height),
    };
  }

  if (kind === "video" || kind === "audio") {
    const av = await readAV(file);
    return {
      ...base,
      ...av,
      orientation: kind === "video" ? computeOrientation(av.width, av.height) : undefined,
    };
  }

  return base;
}
