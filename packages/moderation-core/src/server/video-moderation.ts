import {
  isRejectionLikelihood,
  likelihoodToString,
  LIKELIHOOD_ORDER,
} from "../likelihood.js";
import type {
  Likelihood,
  MediaModerationResult,
  ModerationLogger,
} from "../types.js";

import type { VideoIntelligenceServiceClient } from "@google-cloud/video-intelligence";

/** Poll cadence for the annotateVideo long-running operation. */
export interface VideoPollBackoff {
  initialDelayMillis: number;
  delayMultiplier: number;
  maxDelayMillis: number;
}

/**
 * Without an explicit `longrunning` backoff, gax polls the operation starting at
 * 100ms (×1.3), which burns ~20 'Requests per minute' of Video Intelligence quota
 * per video. Scans take tens of seconds, so the first poll waits 10s.
 */
export const DEFAULT_VIDEO_POLL_BACKOFF: VideoPollBackoff = {
  initialDelayMillis: 10_000,
  delayMultiplier: 1.5,
  maxDelayMillis: 60_000,
};

export interface VideoModerationOptions {
  rejectionLikelihoods: ReadonlySet<string>;
  logger?: ModerationLogger;
  getClient?: () => Promise<VideoIntelligenceServiceClient>;
  pollBackoff?: VideoPollBackoff;
}

let _defaultClient: VideoIntelligenceServiceClient | null = null;
async function defaultGetVideoClient(): Promise<VideoIntelligenceServiceClient> {
  if (_defaultClient) return _defaultClient;
  const mod = await import("@google-cloud/video-intelligence");
  _defaultClient = new mod.VideoIntelligenceServiceClient();
  return _defaultClient;
}

/**
 * Moderate a video via Google Cloud Video Intelligence.
 * @param gcsUri - MUST be a GCS URI ("gs://bucket/path"); HTTPS URLs are not supported by the API.
 */
export async function moderateVideo(
  gcsUri: string,
  options: VideoModerationOptions,
): Promise<MediaModerationResult> {
  const { rejectionLikelihoods, logger } = options;
  const getClient = options.getClient ?? defaultGetVideoClient;

  logger?.info?.(`[moderation-core] Video moderation: ${gcsUri}`);

  const { protos } = await import("@google-cloud/video-intelligence");
  const client = await getClient();

  const pollBackoff = options.pollBackoff ?? DEFAULT_VIDEO_POLL_BACKOFF;
  const [operation] = await client.annotateVideo(
    {
      inputUri: gcsUri,
      features: [
        protos.google.cloud.videointelligence.v1.Feature.EXPLICIT_CONTENT_DETECTION,
      ],
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

  if (!explicitAnnotation?.frames?.length) {
    logger?.warn?.("[moderation-core] No explicit-content frames returned; allowing content");
    return { safe: true, scores: { adult: "UNKNOWN", violence: "UNKNOWN", racy: "UNKNOWN" } };
  }

  let maxAdult: Likelihood = "VERY_UNLIKELY";
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
  const reason = safe ? undefined : "Adult or sexually explicit content is not allowed";

  return {
    safe,
    reason,
    scores: { adult: maxAdult, violence: "NOT_CHECKED", racy: "NOT_CHECKED" },
  };
}

export function __resetDefaultVideoClient() {
  _defaultClient = null;
}
