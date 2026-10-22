// MediaRecorder and some pickers report parameterized types ("audio/webm;codecs=opus"), and
// downstream checks validate the parameter-less base, so only the base is ever emitted.

import { NEUTRAL_CONTENT_TYPE } from '@ttt-productions/media-schemas';

export type InferKind = 'image' | 'video' | 'audio';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
};

const AMBIGUOUS_EXT_TO_MIME: Record<string, Partial<Record<InferKind, string>>> = {
  webm: { audio: 'audio/webm', video: 'video/webm' },
  ogg: { audio: 'audio/ogg', video: 'video/ogg' },
};

const KIND_DEFAULT: Record<InferKind, string> = {
  image: 'image/jpeg',
  video: 'video/webm',
  audio: 'audio/webm',
};

const BASE_MEDIA_MIME_RE = /^(image|video|audio)\/[a-z0-9.+-]+$/;

function parseBaseMime(mime: string | undefined | null): string | null {
  if (!mime) return null;
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base === NEUTRAL_CONTENT_TYPE) return null;
  return BASE_MEDIA_MIME_RE.test(base) ? base : null;
}

function kindOfMime(base: string): InferKind {
  return base.slice(0, base.indexOf('/')) as InferKind;
}

function extOf(name: string): string | null {
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

export function inferContentType(file: File, fallbackKind?: InferKind): string {
  const base = parseBaseMime(file.type);
  if (base && (!fallbackKind || kindOfMime(base) === fallbackKind)) return base;

  const ext = extOf(file.name);
  if (ext) {
    const byKind = fallbackKind ? AMBIGUOUS_EXT_TO_MIME[ext]?.[fallbackKind] : undefined;
    if (byKind) return byKind;
    if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  }

  if (fallbackKind) return KIND_DEFAULT[fallbackKind];

  return NEUTRAL_CONTENT_TYPE;
}

export function ensureFileWithContentType(file: File, fallbackKind?: InferKind): File {
  const type = inferContentType(file, fallbackKind);
  if (file.type === type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}
