import { describe, it, expect } from 'vitest';
import { success, failure } from '../src/processing/result';

describe('success', () => {
  it('sets ok to true', () => {
    const result = success({ mediaType: 'image' });
    expect(result.ok).toBe(true);
  });

  it('spreads the rest of the result fields', () => {
    const result = success({ mediaType: 'video', output: { url: 'https://example.com/video.mp4' } as any });
    expect(result.mediaType).toBe('video');
    expect(result.output).toEqual({ url: 'https://example.com/video.mp4' });
  });

  it('preserves moderation field', () => {
    const moderation = { status: 'passed' as const };
    const result = success({ mediaType: 'image', moderation });
    expect(result.moderation).toEqual(moderation);
  });
});

describe('failure', () => {
  it('sets ok to false', () => {
    const result = failure({ code: 'INVALID_SIZE', message: 'Too large' });
    expect(result.ok).toBe(false);
  });

  it('sets mediaType to "other"', () => {
    const result = failure({ code: 'SOME_ERROR', message: 'Error' });
    expect(result.mediaType).toBe('other');
  });

  it('includes the error', () => {
    const error = { code: 'INVALID_MIME', message: 'Bad mime', details: { mime: 'text/plain' } };
    const result = failure(error);
    expect(result.error).toEqual(error);
  });

  it('error with details preserved', () => {
    const error = { code: 'CODE', message: 'msg', details: { key: 'value' } };
    const result = failure(error);
    expect(result.error?.details).toEqual({ key: 'value' });
  });
});
