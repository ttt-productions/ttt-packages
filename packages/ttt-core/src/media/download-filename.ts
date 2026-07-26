// ============================================================================
// DOWNLOAD FILENAME — the ONE canonical normalizer for the server-owned filename
// the media gateway puts in `Content-Disposition` for a `?download=1` request,
// plus the pure RFC 6266 / RFC 8187 string forms that header is assembled from.
//
// Ownership (ENG-002 / ARCH-101): the escaping and sanitization logic lives HERE,
// once. Backend publishers (Work Files, Conversation Files, downloadable Hall
// media) run `normalizeDownloadFilename` when they write a variant's
// `downloadFilename`; the media Worker defensively runs it AGAIN before building
// the header (a record is backend-authored, but the header is the trust boundary),
// then assembles the header from `buildContentDispositionFilenameForms`. Header
// ASSEMBLY stays worker-side — this module only produces the two string forms.
//
// Everything here is PURE: no env, no I/O, no clock, no crypto. It runs unchanged
// in Cloud Functions (Node 22) and in the Cloudflare Worker.
//
// Filenames are USER CONTENT. Never log them — not the raw input, not the output.
//
// See ttt-prod docs/design/media-assets-and-protected-serving.md and
// docs/code_changes_needed/CODE_CHANGE_invite_finalization_conversation_files_and_downloads.md
// (§3 "Gateway downloads").
// ============================================================================

import {
  DOWNLOAD_FILENAME_FALLBACK_STEM,
  MAX_DOWNLOAD_FILENAME_BYTES,
} from '../constants/media-download.js';

// ---------------------------------------------------------------------------
// contentType → extension
// ---------------------------------------------------------------------------

/**
 * Extensions per media type. The FIRST entry is canonical (what a corrected name
 * gets); the rest are accepted aliases that are left alone when the input already
 * carries one (so `photo.jpeg` stays `.jpeg` for an `image/jpeg` variant instead
 * of being churned to `.jpg`).
 *
 * The served variant's contentType is authoritative: a transcoded JPEG/WebP/MP4
 * is never labelled with the original upload's incompatible extension.
 */
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

/** Non-canonical spellings seen in the wild, mapped onto the canonical essence. */
const CONTENT_TYPE_ALIASES: Readonly<Record<string, string>> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'video/x-m4v': 'video/mp4',
};

/** `image/JPEG; charset=binary` → `image/jpeg`. Empty string when unusable. */
function contentTypeEssence(contentType: string | null | undefined): string {
  if (typeof contentType !== 'string') return '';
  const essence = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_ALIASES[essence] ?? essence;
}

/**
 * The canonical file extension (no leading dot) for a served contentType, or
 * `null` when the type is unknown/absent. Exported because the same mapping is
 * the honest answer to "what extension may this variant's bytes carry".
 */
export function extensionForContentType(contentType: string | null | undefined): string | null {
  const known = CONTENT_TYPE_EXTENSIONS[contentTypeEssence(contentType)];
  return known ? known[0] : null;
}

/** Every extension accepted as already-correct for a contentType (canonical first). */
function acceptedExtensions(contentType: string | null | undefined): readonly string[] {
  return CONTENT_TYPE_EXTENSIONS[contentTypeEssence(contentType)] ?? [];
}

// ---------------------------------------------------------------------------
// sanitization primitives
// ---------------------------------------------------------------------------

/** C0 + DEL + C1 controls (CR/LF included — header-injection primitives). */
// eslint-disable-next-line no-control-regex -- matching control characters IS the point here: this class is exactly what must be stripped (CR/LF header injection).
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
/** Bidi overrides/isolates — invisible reordering used to disguise an extension. */
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
/** Path separators + the Windows-reserved set + every quote form. */
const UNSAFE_FILENAME_CHARS = /[/\\<>:"|?*'\u2018\u2019\u201C\u201D\u0060]/g;

/** Windows reserved device names — unusable as a filename stem on that platform. */
const RESERVED_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A plausible extension: short and alphanumeric. Anything else is part of the stem. */
const EXTENSION_SHAPE = /^[A-Za-z0-9]{1,10}$/;

const utf8 = new TextEncoder();

/** UTF-8 byte length of a string. */
function utf8ByteLength(value: string): number {
  return utf8.encode(value).length;
}

/**
 * Truncate to at most `maxBytes` UTF-8 bytes, never splitting a code point.
 * Iterating with `for…of` walks CODE POINTS (surrogate pairs stay intact), so an
 * emoji is either wholly kept or wholly dropped — never cut into lone surrogates.
 */
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

/** Strip the leading path, whatever separator style produced it. */
function takeBasename(value: string): string {
  const segments = value.split(/[/\\]/);
  return segments[segments.length - 1] ?? '';
}

/** Remove everything hostile, collapse whitespace, trim edges + trailing dots. */
function sanitizeSegment(value: string): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_CONTROLS, '')
    .replace(UNSAFE_FILENAME_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trailing spaces and dots are silently dropped by Windows — drop them ourselves. */
function trimTrailingDotsAndSpaces(value: string): string {
  return value.replace(/[\s.]+$/, '');
}

interface SplitName {
  stem: string;
  /** Extension WITHOUT its dot; '' when the name carries none. */
  ext: string;
}

/**
 * Split on the last dot. A leading dot is NOT an extension separator (`.gitignore`
 * is a stem), and a long or non-alphanumeric tail is treated as part of the stem
 * (`Version 2.5 notes` keeps its `.5 notes`).
 */
function splitExtension(value: string): SplitName {
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || dot === value.length - 1) return { stem: value, ext: '' };
  const ext = value.slice(dot + 1);
  if (!EXTENSION_SHAPE.test(ext)) return { stem: value, ext: '' };
  return { stem: value.slice(0, dot), ext };
}

// ---------------------------------------------------------------------------
// the normalizer
// ---------------------------------------------------------------------------

export interface NormalizeDownloadFilenameOptions {
  /**
   * The contentType of the variant whose bytes are actually served. When it maps
   * to a known extension, the returned name carries that extension (or an accepted
   * alias the input already had) — never an incompatible original extension.
   */
  contentType?: string | null;
  /** UTF-8 byte cap. Defaults to `MAX_DOWNLOAD_FILENAME_BYTES`. */
  maxBytes?: number;
  /** Neutral stem used when sanitization leaves nothing. Defaults to `DOWNLOAD_FILENAME_FALLBACK_STEM`. */
  fallbackStem?: string;
}

/**
 * The canonical download-filename normalizer. Deterministic, idempotent, and
 * ALWAYS returns a nonempty name.
 *
 * In order: basename only → Unicode NFC → strip control/CR-LF/bidi/path-separator/
 * quote/unsafe-platform characters → collapse whitespace → trim trailing spaces and
 * dots → resolve the extension against the served contentType → replace an empty,
 * dots-only, or Windows-reserved stem → cap by UTF-8 BYTE length on a code-point
 * boundary, keeping the extension.
 *
 * Unicode letters and emoji SURVIVE — they are legal filename content and the
 * RFC 8187 `filename*` form carries them faithfully. The ASCII-only degradation
 * happens later, in `buildContentDispositionFilenameForms`, and only for the
 * RFC 6266 `filename=` fallback.
 */
export function normalizeDownloadFilename(
  rawName: string | null | undefined,
  options: NormalizeDownloadFilenameOptions = {},
): string {
  const maxBytes = options.maxBytes ?? MAX_DOWNLOAD_FILENAME_BYTES;
  const fallbackStem =
    trimTrailingDotsAndSpaces(sanitizeSegment(options.fallbackStem ?? '')) ||
    DOWNLOAD_FILENAME_FALLBACK_STEM;

  const source = typeof rawName === 'string' ? rawName : '';
  const sanitized = trimTrailingDotsAndSpaces(sanitizeSegment(takeBasename(source.normalize('NFC'))));
  const split = splitExtension(sanitized);

  // --- extension: the served contentType is authoritative ---
  const canonicalExt = extensionForContentType(options.contentType);
  const inputExt = split.ext.toLowerCase();
  let ext: string;
  if (canonicalExt) {
    ext = acceptedExtensions(options.contentType).includes(inputExt) ? inputExt : canonicalExt;
  } else {
    ext = inputExt;
  }
  const suffix = ext ? `.${ext}` : '';

  // --- stem: nonempty, not a reserved device name ---
  let stem = trimTrailingDotsAndSpaces(split.stem);
  if (stem.length === 0) stem = fallbackStem;

  // --- byte cap (extension preserved; code points never split) ---
  const budget = maxBytes - utf8ByteLength(suffix);
  if (budget <= 0) {
    // Pathological: the extension alone exceeds the cap. Drop it rather than
    // emit an over-length header value, and keep a usable stem.
    return (
      truncateToUtf8Bytes(stem, maxBytes) ||
      truncateToUtf8Bytes(fallbackStem, maxBytes) ||
      fallbackStem
    );
  }

  if (RESERVED_DEVICE_NAME.test(stem)) stem = `_${stem}`;
  stem = trimTrailingDotsAndSpaces(truncateToUtf8Bytes(stem, budget));
  if (stem.length === 0) stem = trimTrailingDotsAndSpaces(truncateToUtf8Bytes(fallbackStem, budget));
  if (stem.length === 0) return truncateToUtf8Bytes(fallbackStem, maxBytes) || fallbackStem;

  return `${stem}${suffix}`;
}

// ---------------------------------------------------------------------------
// RFC 6266 / RFC 8187 string forms
// ---------------------------------------------------------------------------

/** Combining marks — removed when degrading to ASCII so `café` reads `cafe`. */
const COMBINING_MARKS = /\p{M}+/gu;
/** Printable ASCII that is safe inside an RFC 6266 quoted-string. */
const SAFE_ASCII = /[\u0020-\u007E]/;
/** Header-structural characters kept out of the fallback even though they are ASCII. */
const ASCII_HEADER_HOSTILE = new Set(['"', '\\', ';', ',']);
/** RFC 8187 attr-char: the only bytes that may appear unencoded in an ext-value. */
const ATTR_CHAR = /[A-Za-z0-9!#$&+\-.^_`|~]/;

/** Best-effort ASCII degradation of one name component. */
function toAsciiComponent(value: string): string {
  const stripped = value.normalize('NFD').replace(COMBINING_MARKS, '');
  let out = '';
  for (const ch of stripped) {
    out += ch.length === 1 && SAFE_ASCII.test(ch) && !ASCII_HEADER_HOSTILE.has(ch) ? ch : '_';
  }
  return out
    .replace(/_+/g, '_')
    .replace(/^[_\s]+|[_\s.]+$/g, '');
}

/** Percent-encode every non-`attr-char` byte of the UTF-8 encoding (RFC 8187 §3.2). */
function encodeExtValue(value: string): string {
  let out = '';
  for (const byte of utf8.encode(value)) {
    const ch = String.fromCharCode(byte);
    out += byte < 0x80 && ATTR_CHAR.test(ch) ? ch : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

export interface ContentDispositionFilenameForms {
  /**
   * RFC 6266 `filename=` value: safe printable ASCII only, already free of quotes,
   * backslashes, and header-structural characters, so the Worker may place it inside
   * `filename="…"` verbatim with no further escaping.
   */
  asciiFallback: string;
  /**
   * RFC 8187 ext-value INCLUDING its charset prefix — e.g. `UTF-8''caf%C3%A9.jpg`.
   * Goes straight after `filename*=` UNQUOTED (an ext-value is never quoted).
   */
  extendedValue: string;
}

/**
 * Build both `Content-Disposition` filename forms from a normalized name.
 *
 * The Worker assembles the header itself (emitting `filename` first, `filename*`
 * second per RFC 6266), but the ESCAPING is owned here so the app, the Worker, and
 * the tests can never disagree about it. Defensively re-normalizes, so passing a
 * raw record value can still not produce a CR/LF or quote in a header.
 */
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
