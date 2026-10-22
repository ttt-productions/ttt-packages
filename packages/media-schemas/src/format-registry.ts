import { MediaFormatIdSchema } from './schemas.js';
import type { z } from 'zod';
import type { MediaKind } from './types.js';

export type MediaFormatId = z.infer<typeof MediaFormatIdSchema>;

export type MediaFormatFamily = 'image' | 'audio' | 'av-container';

export interface MediaFormatDefinition {
  readonly formatId: MediaFormatId;
  readonly family: MediaFormatFamily;
  readonly mimes: { readonly all?: readonly string[] } & Partial<
    Record<'image' | 'video' | 'audio', readonly string[]>
  >;
  readonly extensions: readonly string[];
}

export const MEDIA_FORMATS: Readonly<Record<MediaFormatId, MediaFormatDefinition>> = {
  jpeg: {
    formatId: 'jpeg',
    family: 'image',
    mimes: { all: ['image/jpeg'] },
    extensions: ['jpg', 'jpeg'],
  },
  png: { formatId: 'png', family: 'image', mimes: { all: ['image/png'] }, extensions: ['png'] },
  gif: { formatId: 'gif', family: 'image', mimes: { all: ['image/gif'] }, extensions: ['gif'] },
  webp: { formatId: 'webp', family: 'image', mimes: { all: ['image/webp'] }, extensions: ['webp'] },
  bmp: { formatId: 'bmp', family: 'image', mimes: { all: ['image/bmp'] }, extensions: ['bmp'] },
  tiff: {
    formatId: 'tiff',
    family: 'image',
    mimes: { all: ['image/tiff'] },
    extensions: ['tif', 'tiff'],
  },
  avif: { formatId: 'avif', family: 'image', mimes: { all: ['image/avif'] }, extensions: ['avif'] },
  heic: {
    formatId: 'heic',
    family: 'image',
    mimes: { all: ['image/heic', 'image/heif'] },
    extensions: ['heic', 'heif'],
  },
  svg: { formatId: 'svg', family: 'image', mimes: { all: ['image/svg+xml'] }, extensions: ['svg'] },

  mp3: { formatId: 'mp3', family: 'audio', mimes: { all: ['audio/mpeg'] }, extensions: ['mp3'] },
  wav: {
    formatId: 'wav',
    family: 'audio',
    mimes: { all: ['audio/wav', 'audio/x-wav'] },
    extensions: ['wav'],
  },
  flac: { formatId: 'flac', family: 'audio', mimes: { all: ['audio/flac'] }, extensions: ['flac'] },

  isobmff: {
    formatId: 'isobmff',
    family: 'av-container',
    mimes: {
      video: ['video/mp4', 'video/quicktime'],
      audio: ['audio/mp4', 'audio/x-m4a', 'audio/aac'],
    },
    extensions: ['mp4', 'm4v', 'mov', 'm4a', 'aac'],
  },
  webm: {
    formatId: 'webm',
    family: 'av-container',
    mimes: {
      video: ['video/webm', 'video/x-matroska'],
      audio: ['audio/webm'],
    },
    extensions: ['webm', 'mkv'],
  },
  ogg: {
    formatId: 'ogg',
    family: 'av-container',
    mimes: {
      video: ['video/ogg'],
      audio: ['audio/ogg'],
    },
    extensions: ['ogg', 'oga', 'opus'],
  },
};

export function projectAcceptTokens(
  formatIds: readonly MediaFormatId[],
  kinds?: readonly MediaKind[],
): string[] {
  const tokens: string[] = [];
  const wantKind = (k: 'image' | 'video' | 'audio'): boolean =>
    !kinds || kinds.length === 0 || kinds.includes(k);
  for (const id of formatIds) {
    const def = MEDIA_FORMATS[id];
    if (!def) continue;
    const familyKind = def.family === 'image' ? 'image' : def.family === 'audio' ? 'audio' : null;
    if (familyKind) {
      if (!wantKind(familyKind)) continue;
      for (const m of def.mimes.all ?? []) tokens.push(m);
    } else {
      for (const k of ['image', 'video', 'audio'] as const) {
        if (!wantKind(k)) continue;
        for (const m of def.mimes[k] ?? []) tokens.push(m);
      }
    }
    if (familyKind ? wantKind(familyKind) : (['image', 'video', 'audio'] as const).some(wantKind)) {
      for (const ext of def.extensions) tokens.push(`.${ext}`);
    }
  }
  return [...new Set(tokens)];
}
