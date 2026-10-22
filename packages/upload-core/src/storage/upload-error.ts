import { NEUTRAL_CONTENT_TYPE } from '@ttt-productions/media-schemas';

export type UploadErrorCode = 'missing_content_type' | 'invalid_content_type';

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

export function isValidMediaContentType(contentType: string | undefined | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase().trim();
  if (ct === NEUTRAL_CONTENT_TYPE) return false;
  return /^(image|video|audio)\/[a-z0-9.+-]+$/.test(ct);
}
