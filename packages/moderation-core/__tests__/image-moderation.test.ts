import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moderateImage, __resetDefaultVisionClient } from '../src/server/image-moderation.js';

beforeEach(() => {
  __resetDefaultVisionClient();
});

const rejectionLikelihoods = new Set(['LIKELY', 'VERY_LIKELY']);

function makeSafeAnnotation(overrides: Record<string, unknown> = {}) {
  return {
    adult: 'UNLIKELY',
    violence: 'VERY_UNLIKELY',
    racy: 'UNLIKELY',
    ...overrides,
  };
}

describe('moderateImage', () => {
  it('returns safe=true for all-safe content', async () => {
    const mockClient = {
      safeSearchDetection: vi.fn().mockResolvedValue([{
        safeSearchAnnotation: makeSafeAnnotation(),
      }]),
    };
    const result = await moderateImage('gs://bucket/image.jpg', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(true);
  });

  it('returns safe=false with adult reason when adult is LIKELY', async () => {
    const mockClient = {
      safeSearchDetection: vi.fn().mockResolvedValue([{
        safeSearchAnnotation: makeSafeAnnotation({ adult: 'LIKELY' }),
      }]),
    };
    const result = await moderateImage('gs://bucket/image.jpg', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Adult');
    expect(result.scores.adult).toBe('LIKELY');
  });

  it('returns safe=false with violence reason when violence is VERY_LIKELY', async () => {
    const mockClient = {
      safeSearchDetection: vi.fn().mockResolvedValue([{
        safeSearchAnnotation: makeSafeAnnotation({ violence: 'VERY_LIKELY' }),
      }]),
    };
    const result = await moderateImage('gs://bucket/image.jpg', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Violent');
  });

  it('returns safe=false when safeSearchAnnotation is null', async () => {
    const mockClient = {
      safeSearchDetection: vi.fn().mockResolvedValue([{ safeSearchAnnotation: null }]),
    };
    const result = await moderateImage('gs://bucket/image.jpg', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('failed');
    expect(result.scores.adult).toBe('UNKNOWN');
  });
});
