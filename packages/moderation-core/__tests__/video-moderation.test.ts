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

import {
  moderateVideo,
  DEFAULT_VIDEO_POLL_BACKOFF,
  __resetDefaultVideoClient,
} from '../src/server/video-moderation.js';

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

  it('passes the default longrunning poll backoff to annotateVideo', async () => {
    const mockClient = {
      annotateVideo: vi.fn().mockResolvedValue([{
        promise: () => Promise.resolve([{
          annotationResults: [{ explicitAnnotation: { frames: [] } }],
        }]),
      }]),
    };
    await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
    });
    expect(mockClient.annotateVideo).toHaveBeenCalledWith(
      expect.objectContaining({ inputUri: 'gs://bucket/video.mp4' }),
      {
        longrunning: {
          initialRetryDelayMillis: DEFAULT_VIDEO_POLL_BACKOFF.initialDelayMillis,
          retryDelayMultiplier: DEFAULT_VIDEO_POLL_BACKOFF.delayMultiplier,
          maxRetryDelayMillis: DEFAULT_VIDEO_POLL_BACKOFF.maxDelayMillis,
        },
      },
    );
  });

  it('honors a pollBackoff override', async () => {
    const mockClient = {
      annotateVideo: vi.fn().mockResolvedValue([{
        promise: () => Promise.resolve([{
          annotationResults: [{ explicitAnnotation: { frames: [] } }],
        }]),
      }]),
    };
    await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient as never,
      pollBackoff: { initialDelayMillis: 5000, delayMultiplier: 2, maxDelayMillis: 30000 },
    });
    expect(mockClient.annotateVideo).toHaveBeenCalledWith(
      expect.anything(),
      {
        longrunning: {
          initialRetryDelayMillis: 5000,
          retryDelayMultiplier: 2,
          maxRetryDelayMillis: 30000,
        },
      },
    );
  });
});
