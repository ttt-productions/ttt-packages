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

export interface VideoModerationOptions {
  rejectionLikelihoods: ReadonlySet<string>;
  logger?: ModerationLogger;
  getClient?: () => Promise<VideoIntelligenceServiceClient>;
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

  const [operation] = await client.annotateVideo({
    inputUri: gcsUri,
    features: [
      protos.google.cloud.videointelligence.v1.Feature.EXPLICIT_CONTENT_DETECTION,
    ],
  });

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
