import { isRejectionLikelihood, likelihoodToString, LIKELIHOOD_ORDER } from '../likelihood.js';
import type { Likelihood, MediaModerationResult, ModerationLogger } from '../types.js';

import type { VideoIntelligenceServiceClient, protos } from '@google-cloud/video-intelligence';

export interface AnnotateVideoOperation {
  promise(): Promise<
    [protos.google.cloud.videointelligence.v1.IAnnotateVideoResponse, ...unknown[]]
  >;
}

// The one Video Intelligence call video moderation makes, in the one form it calls it; a
// VideoIntelligenceServiceClient is one.
export interface AnnotateVideoClient {
  annotateVideo(
    request: protos.google.cloud.videointelligence.v1.IAnnotateVideoRequest,
    options: { longrunning: VideoAnnotateBackoff },
  ): Promise<[AnnotateVideoOperation, ...unknown[]]>;
}

interface VideoAnnotateBackoff {
  initialRetryDelayMillis: number;
  retryDelayMultiplier: number;
  maxRetryDelayMillis: number;
}

export interface VideoPollBackoff {
  initialDelayMillis: number;
  delayMultiplier: number;
  maxDelayMillis: number;
}

// gax's default long-running poll (100ms, x1.3) spends Video Intelligence per-minute quota.
export const DEFAULT_VIDEO_POLL_BACKOFF: VideoPollBackoff = {
  initialDelayMillis: 10_000,
  delayMultiplier: 1.5,
  maxDelayMillis: 60_000,
};

export interface VideoModerationOptions {
  rejectionLikelihoods: ReadonlySet<string>;
  logger?: ModerationLogger;
  getClient?: () => Promise<AnnotateVideoClient>;
  pollBackoff?: VideoPollBackoff;
}

let _defaultClient: VideoIntelligenceServiceClient | null = null;
async function defaultGetVideoClient(): Promise<AnnotateVideoClient> {
  if (_defaultClient) return _defaultClient;
  const mod = await import('@google-cloud/video-intelligence');
  _defaultClient = new mod.VideoIntelligenceServiceClient();
  return _defaultClient;
}

// Video Intelligence accepts only gs:// URIs, never HTTPS URLs.
export async function moderateVideo(
  gcsUri: string,
  options: VideoModerationOptions,
): Promise<MediaModerationResult> {
  const { rejectionLikelihoods, logger } = options;
  const getClient = options.getClient ?? defaultGetVideoClient;

  logger?.info?.(`[moderation-core] Video moderation: ${gcsUri}`);

  const { protos } = await import('@google-cloud/video-intelligence');
  const client = await getClient();

  const pollBackoff = options.pollBackoff ?? DEFAULT_VIDEO_POLL_BACKOFF;
  const [operation] = await client.annotateVideo(
    {
      inputUri: gcsUri,
      features: [protos.google.cloud.videointelligence.v1.Feature.EXPLICIT_CONTENT_DETECTION],
    },
    {
      longrunning: {
        initialRetryDelayMillis: pollBackoff.initialDelayMillis,
        retryDelayMultiplier: pollBackoff.delayMultiplier,
        maxRetryDelayMillis: pollBackoff.maxDelayMillis,
      },
    },
  );

  const [result] = await operation.promise();
  const annotation = result.annotationResults?.[0];
  const explicitAnnotation = annotation?.explicitAnnotation;

  // An error or an empty frame list means nothing was checked.
  if (annotation?.error || !explicitAnnotation?.frames?.length) {
    logger?.warn?.(
      '[moderation-core] Video analysis returned no checked frames; the video was not checked',
    );
    return {
      checked: false,
      safe: false,
      reason: 'Content moderation check did not complete',
      scores: { adult: 'UNKNOWN', violence: 'UNKNOWN', racy: 'UNKNOWN' },
    };
  }

  let maxAdult: Likelihood = 'VERY_UNLIKELY';
  let foundExplicit = false;

  for (const frame of explicitAnnotation.frames) {
    if (isRejectionLikelihood(frame.pornographyLikelihood, rejectionLikelihoods)) {
      maxAdult = likelihoodToString(frame.pornographyLikelihood);
      foundExplicit = true;
      break;
    }
    const current = likelihoodToString(frame.pornographyLikelihood);
    if (LIKELIHOOD_ORDER[current] > LIKELIHOOD_ORDER[maxAdult]) {
      maxAdult = current;
    }
  }

  const safe = !foundExplicit;
  const reason = safe ? undefined : 'Adult or sexually explicit content is not allowed';

  return {
    checked: true,
    safe,
    reason,
    scores: { adult: maxAdult, violence: 'NOT_CHECKED', racy: 'NOT_CHECKED' },
  };
}

export function __resetDefaultVideoClient() {
  _defaultClient = null;
}
