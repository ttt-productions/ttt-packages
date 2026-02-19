import { describe, it, expect } from 'vitest';
import { processingError } from '../src/processing/errors';

describe('processingError', () => {
  it('returns object with code and message', () => {
    const result = processingError('INVALID_SIZE', 'File too large');
    expect(result.code).toBe('INVALID_SIZE');
    expect(result.message).toBe('File too large');
  });

  it('details is undefined when not provided', () => {
    const result = processingError('SOME_CODE', 'Some message');
    expect(result.details).toBeUndefined();
  });

  it('includes details when provided', () => {
    const details = { maxSize: 1024, actual: 2048 };
    const result = processingError('INVALID_SIZE', 'Too large', details);
    expect(result.details).toEqual(details);
  });

  it('returns a plain object (not an Error instance)', () => {
    const result = processingError('CODE', 'msg');
    expect(result).not.toBeInstanceOf(Error);
    expect(typeof result).toBe('object');
  });

  it('preserves arbitrary details fields', () => {
    const details = { mime: 'video/mp4', allowed: ['image/jpeg'], nested: { a: 1 } };
    const result = processingError('INVALID_MIME', 'Bad mime type', details);
    expect(result.details).toEqual(details);
  });
});
