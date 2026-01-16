import type { SimplifiedMediaType } from "./types";

export type FileLike = {
  type?: string; // mime
  name?: string; // filename
};

function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase();
}

function extFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const idx = name.lastIndexOf(".");
  if (idx === -1) return undefined;
  return name.slice(idx + 1).trim().toLowerCase() || undefined;
}

function simplifiedFromMime(mime: string): SimplifiedMediaType {
  const m = normalizeMime(mime);

  // common vendor/edge cases
  if (m === "application/octet-stream") return "other";

  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";

  // PDFs etc treated as "other" for now
  return "other";
}

function simplifiedFromExt(ext?: string): SimplifiedMediaType {
  if (!ext) return "other";

  // images
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "avif", "heic", "heif"].includes(ext)) {
    return "image";
  }

  // videos
  if (["mp4", "mov", "m4v", "webm", "mkv", "avi"].includes(ext)) {
    return "video";
  }

  // audio
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus"].includes(ext)) {
    return "audio";
  }

  return "other";
}

/**
 * Contracts-only type detection.
 * Accepts a mime string OR a File-like object via structural typing.
 * No DOM usage; safe in frontend + functions.
 */
export function getSimplifiedMediaType(input: string | FileLike | null | undefined): SimplifiedMediaType {
  if (!input) return "other";

  if (typeof input === "string") {
    const s = input.trim();
    // if it looks like a mime
    if (s.includes("/")) return simplifiedFromMime(s);
    // otherwise treat as filename/extension-ish
    return simplifiedFromExt(extFromName(s) ?? s.toLowerCase());
  }

  const mime = input.type?.trim();
  if (mime) return simplifiedFromMime(mime);

  const ext = extFromName(input.name);
  return simplifiedFromExt(ext);
}

export function isImageType(input: string | FileLike | null | undefined): boolean {
  return getSimplifiedMediaType(input) === "image";
}

export function isVideoType(input: string | FileLike | null | undefined): boolean {
  return getSimplifiedMediaType(input) === "video";
}

export function isAudioType(input: string | FileLike | null | undefined): boolean {
  return getSimplifiedMediaType(input) === "audio";
}

/** Simple helper for callers that already have mime. */
export function isSupportedMime(mime: string): boolean {
  const t = simplifiedFromMime(mime);
  return t === "image" || t === "video" || t === "audio";
}
