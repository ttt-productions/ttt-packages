// Download-filename policy for gateway `?download=1` responses.
//
// The media Worker emits `Content-Disposition: attachment; filename="…";
// filename*=UTF-8''…` from the SERVED VARIANT's `downloadFilename`
// (doc-schemas/media-assets.ts). These are the two policy values the canonical
// normalizer (`src/media/download-filename.ts`) derives from — every enforcement
// point imports them, never a literal (ARCH-102).

/**
 * Hard cap on a normalized download filename, measured in UTF-8 BYTES (not code
 * points) — the unit that actually matters, because the RFC 8187 `filename*`
 * form percent-encodes each non-attr byte to three characters, so a byte cap is
 * what bounds the emitted header. A name over the cap is truncated on a code-point
 * boundary; the extension is always preserved.
 */
export const MAX_DOWNLOAD_FILENAME_BYTES = 200;

/**
 * The nonempty fallback stem used when sanitization leaves nothing usable
 * (empty input, an all-punctuation name, a name that was entirely control
 * characters or non-ASCII once the ASCII fallback form is derived). Deliberately
 * neutral: it must never leak anything about the original private filename.
 */
export const DOWNLOAD_FILENAME_FALLBACK_STEM = 'download';
