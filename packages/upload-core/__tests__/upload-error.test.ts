import { describe, it, expect } from 'vitest';
import { UploadError, isValidMediaContentType } from '../src/storage/upload-error';

describe('UploadError', () => {
  it('carries the code property', () => {
    const err = new UploadError('missing_content_type');
    expect(err.code).toBe('missing_content_type');
  });

  it('is an instance of Error', () => {
    const err = new UploadError('invalid_content_type');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UploadError);
  });

  it('uses the code as default message', () => {
    const err = new UploadError('missing_content_type');
    expect(err.message).toBe('missing_content_type');
  });

  it('accepts a custom message', () => {
    const err = new UploadError('missing_content_type', 'Custom message');
    expect(err.message).toBe('Custom message');
  });

  it('has the correct name', () => {
    const err = new UploadError('missing_content_type');
    expect(err.name).toBe('UploadError');
  });
});

describe('isValidMediaContentType', () => {
  it('accepts image/*', () => {
    expect(isValidMediaContentType('image/jpeg')).toBe(true);
    expect(isValidMediaContentType('image/png')).toBe(true);
    expect(isValidMediaContentType('image/webp')).toBe(true);
    expect(isValidMediaContentType('image/gif')).toBe(true);
  });

  it('accepts video/*', () => {
    expect(isValidMediaContentType('video/mp4')).toBe(true);
    expect(isValidMediaContentType('video/webm')).toBe(true);
    expect(isValidMediaContentType('video/quicktime')).toBe(true);
  });

  it('accepts audio/*', () => {
    expect(isValidMediaContentType('audio/mpeg')).toBe(true);
    expect(isValidMediaContentType('audio/webm')).toBe(true);
    expect(isValidMediaContentType('audio/wav')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidMediaContentType('IMAGE/JPEG')).toBe(true);
    expect(isValidMediaContentType('Video/MP4')).toBe(true);
  });

  it('rejects empty strings and nullish', () => {
    expect(isValidMediaContentType('')).toBe(false);
    expect(isValidMediaContentType(undefined)).toBe(false);
    expect(isValidMediaContentType(null)).toBe(false);
  });

  it('rejects application/octet-stream', () => {
    expect(isValidMediaContentType('application/octet-stream')).toBe(false);
  });

  it('rejects non-media MIMEs', () => {
    expect(isValidMediaContentType('application/pdf')).toBe(false);
    expect(isValidMediaContentType('text/plain')).toBe(false);
    expect(isValidMediaContentType('application/json')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidMediaContentType('image')).toBe(false);
    expect(isValidMediaContentType('image/')).toBe(false);
    expect(isValidMediaContentType('/jpeg')).toBe(false);
  });
});
