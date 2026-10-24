// Pure, with no env, I/O, clock, or crypto: it runs unchanged in Cloud Functions and the Cloudflare
// Worker.

import {
  DOWNLOAD_FILENAME_FALLBACK_STEM,
  MAX_DOWNLOAD_FILENAME_BYTES,
} from '../constants/media-download.js';

const CONTENT_TYPE_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/avif': ['avif'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
  'image/bmp': ['bmp'],
  'image/tiff': ['tiff', 'tif'],
  'image/svg+xml': ['svg'],
  'video/mp4': ['mp4', 'm4v'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
  'video/x-matroska': ['mkv'],
  'video/ogg': ['ogv'],
  'audio/mpeg': ['mp3'],
  'audio/mp4': ['m4a'],
  'audio/aac': ['aac'],
  'audio/flac': ['flac'],
  'audio/x-flac': ['flac'],
  'audio/wav': ['wav'],
  'audio/x-wav': ['wav'],
  'audio/webm': ['weba'],
  'audio/ogg': ['ogg', 'oga'],
  'application/pdf': ['pdf'],
};

const CONTENT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'video/x-m4v': 'video/mp4',
};

function contentTypeEssence(contentType: string | null | undefined): string {
  if (typeof contentType !== 'string') return '';
  const essence = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_ALIASES[essence] ?? essence;
}

export function extensionForContentType(contentType: string | null | undefined): string | null {
  const known = CONTENT_TYPE_EXTENSIONS[contentTypeEssence(contentType)];
  return known ? known[0] : null;
}

function acceptedExtensions(contentType: string | null | undefined): readonly string[] {
  return CONTENT_TYPE_EXTENSIONS[contentTypeEssence(contentType)] ?? [];
}

function isControlCharacter(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function stripControlCharacters(value: string): string {
  let kept = '';
  for (const char of value) {
    if (!isControlCharacter(char.codePointAt(0) ?? 0)) kept += char;
  }
  return kept;
}

const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const UNSAFE_FILENAME_CHARS = /[/\\<>:"|?*'\u2018\u2019\u201C\u201D\u0060]/g;

const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const EXTENSION_SHAPE = /^[A-Za-z0-9]{1,10}$/;

const utf8 = new TextEncoder();

function utf8ByteLength(value: string): number {
  return utf8.encode(value).length;
}

// `for…of` walks code points, so a surrogate pair is never split.
function truncateToUtf8Bytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  if (utf8ByteLength(value) <= maxBytes) return value;
  let out = '';
  let used = 0;
  for (const codePoint of value) {
    const size = utf8ByteLength(codePoint);
    if (used + size > maxBytes) break;
    out += codePoint;
    used += size;
  }
  return out;
}

function takeBasename(value: string): string {
  const segments = value.split(/[/\\]/);
  return segments[segments.length - 1] ?? '';
}

function sanitizeSegment(value: string): string {
  return stripControlCharacters(value)
    .replace(BIDI_CONTROLS, '')
    .replace(UNSAFE_FILENAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Windows silently drops trailing spaces and dots.
function trimTrailingDotsAndSpaces(value: string): string {
  return value.replace(/[\s.]+$/, '');
}

interface SplitName {
  stem: string;
  ext: string;
}

function splitExtension(value: string): SplitName {
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || dot === value.length - 1) return { stem: value, ext: '' };
  const ext = value.slice(dot + 1);
  if (!EXTENSION_SHAPE.test(ext)) return { stem: value, ext: '' };
  return { stem: value.slice(0, dot), ext };
}

export interface NormalizeDownloadFilenameOptions {
  contentType?: string | null;
  maxBytes?: number;
  fallbackStem?: string;
}

export function normalizeDownloadFilename(
  rawName: string | null | undefined,
  options: NormalizeDownloadFilenameOptions = {},
): string {
  const maxBytes = options.maxBytes ?? MAX_DOWNLOAD_FILENAME_BYTES;
  const fallbackStem =
    trimTrailingDotsAndSpaces(sanitizeSegment(options.fallbackStem ?? '')) ||
    DOWNLOAD_FILENAME_FALLBACK_STEM;

  const source = typeof rawName === 'string' ? rawName : '';
  const sanitized = trimTrailingDotsAndSpaces(
    sanitizeSegment(takeBasename(source.normalize('NFC'))),
  );
  const split = splitExtension(sanitized);

  const canonicalExt = extensionForContentType(options.contentType);
  const inputExt = split.ext.toLowerCase();
  let ext: string;
  if (canonicalExt) {
    ext = acceptedExtensions(options.contentType).includes(inputExt) ? inputExt : canonicalExt;
  } else {
    ext = inputExt;
  }
  const suffix = ext ? `.${ext}` : '';

  let stem = trimTrailingDotsAndSpaces(split.stem);
  if (stem.length === 0) stem = fallbackStem;

  const budget = maxBytes - utf8ByteLength(suffix);
  if (budget <= 0) {
    return (
      truncateToUtf8Bytes(stem, maxBytes) ||
      truncateToUtf8Bytes(fallbackStem, maxBytes) ||
      fallbackStem
    );
  }

  if (RESERVED_DEVICE_NAME.test(stem)) stem = `_${stem}`;
  stem = trimTrailingDotsAndSpaces(truncateToUtf8Bytes(stem, budget));
  if (stem.length === 0)
    stem = trimTrailingDotsAndSpaces(truncateToUtf8Bytes(fallbackStem, budget));
  if (stem.length === 0) return truncateToUtf8Bytes(fallbackStem, maxBytes) || fallbackStem;

  return `${stem}${suffix}`;
}

const COMBINING_MARKS = /\p{M}+/gu;
const SAFE_ASCII = /[\u0020-\u007E]/;
const ASCII_HEADER_HOSTILE = new Set(['"', '\\', ';', ',']);
const ATTR_CHAR = /[A-Za-z0-9!#$&+\-.^_`|~]/;

function toAsciiComponent(value: string): string {
  const stripped = value.normalize('NFD').replace(COMBINING_MARKS, '');
  let out = '';
  for (const ch of stripped) {
    out += ch.length === 1 && SAFE_ASCII.test(ch) && !ASCII_HEADER_HOSTILE.has(ch) ? ch : '_';
  }
  return out.replace(/_+/g, '_').replace(/^[_\s]+|[_\s.]+$/g, '');
}

function encodeExtValue(value: string): string {
  let out = '';
  for (const byte of utf8.encode(value)) {
    const ch = String.fromCharCode(byte);
    out +=
      byte < 0x80 && ATTR_CHAR.test(ch)
        ? ch
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

export interface ContentDispositionFilenameForms {
  asciiFallback: string;
  // Placed after `filename*=` unquoted: an RFC 8187 ext-value is never quoted.
  extendedValue: string;
}

export function buildContentDispositionFilenameForms(
  normalizedFilename: string,
  options: NormalizeDownloadFilenameOptions = {},
): ContentDispositionFilenameForms {
  const safeName = normalizeDownloadFilename(normalizedFilename, options);
  const { stem, ext } = splitExtension(safeName);
  const asciiStem = toAsciiComponent(stem) || DOWNLOAD_FILENAME_FALLBACK_STEM;
  const asciiExt = ext.replace(/[^A-Za-z0-9]/g, '').toLowerCase();

  return {
    asciiFallback: asciiExt ? `${asciiStem}.${asciiExt}` : asciiStem,
    extendedValue: `UTF-8''${encodeExtValue(safeName)}`,
  };
}
