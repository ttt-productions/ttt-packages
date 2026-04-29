import { describe, it, expect } from 'vitest';
import {
  MediaCropSpecSchema,
  parseMediaProcessingSpec,
  parseMediaProcessingResult,
} from '../src/schemas';

describe('MediaCropSpecSchema', () => {
  const validCrop = {
    aspectRatio: 1.5,
    outputWidth: 800,
    outputHeight: 600,
  };

  it('accepts a valid crop spec', () => {
    expect(() => MediaCropSpecSchema.parse(validCrop)).not.toThrow();
  });

  it('accepts optional fields', () => {
    const withOptions = {
      ...validCrop,
      shape: 'round' as const,
      format: 'webp' as const,
      quality: 85,
      aspectRatioDisplay: '4:3',
    };
    expect(() => MediaCropSpecSchema.parse(withOptions)).not.toThrow();
  });

  it('rejects quality of 0 (min is 1)', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, quality: 0 })).toThrow();
  });

  it('accepts quality of 1', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, quality: 1 })).not.toThrow();
  });

  it('accepts quality of 100', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, quality: 100 })).not.toThrow();
  });

  it('rejects quality of 101 (max is 100)', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, quality: 101 })).toThrow();
  });

  it('rejects non-positive aspectRatio', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, aspectRatio: 0 })).toThrow();
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, aspectRatio: -1 })).toThrow();
  });

  it('rejects unknown fields (strict mode)', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, unknownField: true })).toThrow();
  });

  it('rejects non-integer outputWidth', () => {
    expect(() => MediaCropSpecSchema.parse({ ...validCrop, outputWidth: 1.5 })).toThrow();
  });
});

describe('parseMediaProcessingSpec', () => {
  const validSpec = { kind: 'image' as const };

  it('accepts a minimal valid spec', () => {
    expect(() => parseMediaProcessingSpec(validSpec)).not.toThrow();
  });

  it('accepts a spec with kind "video"', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'video' })).not.toThrow();
  });

  it('accepts a spec with kind "audio"', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'audio' })).not.toThrow();
  });

  it('accepts a spec with kind "generic"', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'generic' })).not.toThrow();
  });

  it('rejects spec missing required "kind"', () => {
    expect(() => parseMediaProcessingSpec({})).toThrow();
  });

  it('rejects spec with invalid kind value', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'document' })).toThrow();
  });

  it('rejects unknown top-level fields (strict mode)', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'image', unknownField: true })).toThrow();
  });

  it('accepts optional maxBytes', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'image', maxBytes: 5000000 })).not.toThrow();
  });

  it('rejects non-integer maxBytes', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'image', maxBytes: 1.5 })).toThrow();
  });

  it('accepts specVersion 1', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'image', specVersion: 1 })).not.toThrow();
  });

  it('accepts specVersion 2', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'image', specVersion: 2 })).not.toThrow();
  });

  it('rejects specVersion 3', () => {
    expect(() => parseMediaProcessingSpec({ kind: 'image', specVersion: 3 })).toThrow();
  });
});

describe('parseMediaProcessingResult', () => {
  const validResult = {
    ok: true,
    mediaType: 'image' as const,
  };

  it('accepts a minimal valid result', () => {
    expect(() => parseMediaProcessingResult(validResult)).not.toThrow();
  });

  it('accepts a failed result', () => {
    const failedResult = {
      ok: false,
      mediaType: 'image' as const,
      error: {
        code: 'upload_failed' as const,
        message: 'Upload failed',
      },
    };
    expect(() => parseMediaProcessingResult(failedResult)).not.toThrow();
  });

  it('rejects missing "ok" field', () => {
    expect(() => parseMediaProcessingResult({ mediaType: 'image' })).toThrow();
  });

  it('rejects missing "mediaType" field', () => {
    expect(() => parseMediaProcessingResult({ ok: true })).toThrow();
  });

  it('rejects invalid mediaType', () => {
    expect(() => parseMediaProcessingResult({ ok: true, mediaType: 'document' })).toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() => parseMediaProcessingResult({ ...validResult, extra: 'nope' })).toThrow();
  });
});
