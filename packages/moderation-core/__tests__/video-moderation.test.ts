import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google-cloud/video-intelligence', () => ({
  VideoIntelligenceServiceClient: vi.fn(),
  protos: {
    google: {
      cloud: {
        videointelligence: {
          v1: {
            Feature: {
              EXPLICIT_CONTENT_DETECTION: 1,
            },
          },
        },
      },
    },
  },
}));

import { moderateVideo, __resetDefaultVideoClient } from '../src/server/video-moderation.js';

beforeEach(() => {
  __resetDefaultVideoClient();
});

const rejectionLikelihoods = new Set(['LIKELY', 'VERY_LIKELY']);

describe('moderateVideo', () => {
  it('returns safe=false when a frame has pornographyLikelihood=5 (VERY_LIKELY)', async () => {
    const mockClient = {
      annotateVideo: vi.fn().mockResolvedValue([{
        promise: () => Promise.resolve([{
          annotationResults: [{
            explicitAnnotation: {
              frames: [{ pornographyLikelihood: 5 }],
            },
          }],
        }]),
      }]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
    expect(result.scores.adult).toBe('VERY_LIKELY');
  });

  it('returns safe=true when frames array is empty', async () => {
    const mockClient = {
      annotateVideo: vi.fn().mockResolvedValue([{
        promise: () => Promise.resolve([{
          annotationResults: [{
            explicitAnnotation: { frames: [] },
          }],
        }]),
      }]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(true);
  });

  it('returns safe=true when no explicit annotation is present', async () => {
    const mockClient = {
      annotateVideo: vi.fn().mockResolvedValue([{
        promise: () => Promise.resolve([{
          annotationResults: [{ explicitAnnotation: null }],
        }]),
      }]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(result.safe).toBe(true);
  });
});
