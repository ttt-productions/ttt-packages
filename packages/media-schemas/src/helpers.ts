import type { SimplifiedMediaType } from './types.js';

export const NEUTRAL_CONTENT_TYPE = 'application/octet-stream';

export type FileLike = {
  type?: string;
  name?: string;
};

function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase();
}

function extFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const idx = name.lastIndexOf('.');
  if (idx === -1) return undefined;
  return (
    name
      .slice(idx + 1)
      .trim()
      .toLowerCase() || undefined
  );
}

function simplifiedFromMime(mime: string): SimplifiedMediaType {
  const m = normalizeMime(mime);

  if (m === NEUTRAL_CONTENT_TYPE) return 'other';

  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';

  return 'other';
}

function simplifiedFromExt(ext?: string): SimplifiedMediaType {
  if (!ext) return 'other';

  if (
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'].includes(
      ext,
    )
  ) {
    return 'image';
  }

  if (['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(ext)) {
    return 'video';
  }

  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus'].includes(ext)) {
    return 'audio';
  }

  return 'other';
}

export function getSimplifiedMediaType(
  input: string | FileLike | null | undefined,
): SimplifiedMediaType {
  if (!input) return 'other';

  if (typeof input === 'string') {
    const s = input.trim();
    if (s.includes('/')) return simplifiedFromMime(s);
    return simplifiedFromExt(extFromName(s) ?? s.toLowerCase());
  }

  const mime = input.type?.trim();
  if (mime) return simplifiedFromMime(mime);

  const ext = extFromName(input.name);
  return simplifiedFromExt(ext);
}

export function isImageType(input: string | FileLike | null | undefined): boolean {
  return getSimplifiedMediaType(input) === 'image';
}

export function isVideoType(input: string | FileLike | null | undefined): boolean {
  return getSimplifiedMediaType(input) === 'video';
}

export function isAudioType(input: string | FileLike | null | undefined): boolean {
  return getSimplifiedMediaType(input) === 'audio';
}

export function isSupportedMime(mime: string): boolean {
  const t = simplifiedFromMime(mime);
  return t === 'image' || t === 'video' || t === 'audio';
}
