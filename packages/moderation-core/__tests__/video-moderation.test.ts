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

import type { AnnotateVideoClient } from '../src/server/video-moderation.js';
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
    const mockClient: AnnotateVideoClient = {
      annotateVideo: vi.fn().mockResolvedValue([
        {
          promise: () =>
            Promise.resolve([
              {
                annotationResults: [
                  {
                    explicitAnnotation: {
                      frames: [{ pornographyLikelihood: 5 }],
                    },
                  },
                ],
              },
            ]),
        },
      ]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient,
    });
    expect(result.checked).toBe(true);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('Adult or sexually explicit content is not allowed');
    expect(result.scores.adult).toBe('VERY_LIKELY');
  });

  it('reports a video the analysis returned no frames for as not checked, never as flagged', async () => {
    const mockClient: AnnotateVideoClient = {
      annotateVideo: vi.fn().mockResolvedValue([
        {
          promise: () =>
            Promise.resolve([
              {
                annotationResults: [
                  {
                    explicitAnnotation: { frames: [] },
                  },
                ],
              },
            ]),
        },
      ]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient,
    });
    expect(result.checked).toBe(false);
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('Content moderation check did not complete');
  });

  it('reports a video with no explicit annotation as not checked', async () => {
    const mockClient: AnnotateVideoClient = {
      annotateVideo: vi.fn().mockResolvedValue([
        {
          promise: () =>
            Promise.resolve([
              {
                annotationResults: [{ explicitAnnotation: null }],
              },
            ]),
        },
      ]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient,
    });
    expect(result.checked).toBe(false);
    expect(result.safe).toBe(false);
  });

  it('reports a video whose analysis carries an error as not checked, even with frames', async () => {
    const mockClient: AnnotateVideoClient = {
      annotateVideo: vi.fn().mockResolvedValue([
        {
          promise: () =>
            Promise.resolve([
              {
                annotationResults: [
                  {
                    error: { code: 13, message: 'internal' },
                    explicitAnnotation: { frames: [{ pornographyLikelihood: 1 }] },
                  },
                ],
              },
            ]),
        },
      ]),
    };
    const result = await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient,
    });
    expect(result.checked).toBe(false);
    expect(result.safe).toBe(false);
  });

  it('passes the default longrunning poll backoff to annotateVideo', async () => {
    const mockClient: AnnotateVideoClient = {
      annotateVideo: vi.fn().mockResolvedValue([
        {
          promise: () =>
            Promise.resolve([
              {
                annotationResults: [{ explicitAnnotation: { frames: [] } }],
              },
            ]),
        },
      ]),
    };
    await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient,
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
    const mockClient: AnnotateVideoClient = {
      annotateVideo: vi.fn().mockResolvedValue([
        {
          promise: () =>
            Promise.resolve([
              {
                annotationResults: [{ explicitAnnotation: { frames: [] } }],
              },
            ]),
        },
      ]),
    };
    await moderateVideo('gs://bucket/video.mp4', {
      rejectionLikelihoods,
      getClient: async () => mockClient,
      pollBackoff: { initialDelayMillis: 5000, delayMultiplier: 2, maxDelayMillis: 30000 },
    });
    expect(mockClient.annotateVideo).toHaveBeenCalledWith(expect.anything(), {
      longrunning: {
        initialRetryDelayMillis: 5000,
        retryDelayMultiplier: 2,
        maxRetryDelayMillis: 30000,
      },
    });
  });
});
