export type UploadErrorCode =
  | 'missing_content_type'
  | 'invalid_content_type';

/**
 * Typed error thrown by upload-core when a client-side guard rejects an upload
 * before it reaches Firebase Storage. Consumers can catch this and show a
 * friendly message instead of parsing a storage 403.
 */
export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'UploadError';
    this.code = code;
    // Preserve prototype chain for `instanceof` checks after transpilation
    Object.setPrototypeOf(this, UploadError.prototype);
  }
}

/**
 * Returns true if the given string looks like a valid media MIME type
 * accepted by TTT's storage rules: image/*, video/*, or audio/*.
 * Empty strings, application/octet-stream, and anything else → false.
 */
export function isValidMediaContentType(contentType: string | undefined | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase().trim();
  if (ct === 'application/octet-stream') return false;
  return /^(image|video|audio)\/[a-z0-9.+-]+$/.test(ct);
}
