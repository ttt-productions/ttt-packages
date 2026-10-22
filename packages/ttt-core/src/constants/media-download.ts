// UTF-8 bytes: RFC 8187 `filename*` percent-encodes each byte to three characters, so a byte cap
// bounds the header.
export const MAX_DOWNLOAD_FILENAME_BYTES = 200;

export const DOWNLOAD_FILENAME_FALLBACK_STEM = 'download';
