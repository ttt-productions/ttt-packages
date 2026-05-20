import {
  isRejectionLikelihood,
  likelihoodToString,
} from "../likelihood.js";
import type {
  MediaModerationResult,
  ModerationLogger,
} from "../types.js";

// Type-only imports — the runtime modules are loaded dynamically.
import type * as vision from "@google-cloud/vision";

export interface ImageModerationOptions {
  /** Set of likelihood strings that should cause rejection (e.g. new Set(["LIKELY","VERY_LIKELY"])). */
  rejectionLikelihoods: ReadonlySet<string>;
  /** Optional logger. */
  logger?: ModerationLogger;
  /** Lazy Vision client provider. Defaults to constructing a new ImageAnnotatorClient on first call. */
  getClient?: () => Promise<vision.ImageAnnotatorClient>;
}

let _defaultClient: vision.ImageAnnotatorClient | null = null;
async function defaultGetVisionClient(): Promise<vision.ImageAnnotatorClient> {
  if (_defaultClient) return _defaultClient;
  const mod = await import("@google-cloud/vision");
  _defaultClient = new mod.ImageAnnotatorClient();
  return _defaultClient;
}

/**
 * Moderate an image via Google Cloud Vision SafeSearch.
 * Throws on system errors (quota, network, etc.); returns a result on policy decisions.
 *
 * @param imageSource - GCS URI ("gs://bucket/path") or HTTPS URL.
 */
export async function moderateImage(
  imageSource: string,
  options: ImageModerationOptions,
): Promise<MediaModerationResult> {
  const { rejectionLikelihoods, logger } = options;
  const getClient = options.getClient ?? defaultGetVisionClient;

  logger?.info?.(`[moderation-core] Image moderation: ${imageSource}`);

  const client = await getClient();
  const [result] = await client.safeSearchDetection(imageSource);
  const safeSearch = result.safeSearchAnnotation;

  if (!safeSearch) {
    logger?.warn?.("[moderation-core] SafeSearch returned no annotation; rejecting as precaution");
    return {
      safe: false,
      reason: "Content moderation check failed",
      scores: { adult: "UNKNOWN", violence: "UNKNOWN", racy: "UNKNOWN" },
    };
  }

  const scores = {
    adult: likelihoodToString(safeSearch.adult),
    violence: likelihoodToString(safeSearch.violence),
    racy: likelihoodToString(safeSearch.racy),
  };

  const isAdult = isRejectionLikelihood(safeSearch.adult, rejectionLikelihoods);
  const isViolent = isRejectionLikelihood(safeSearch.violence, rejectionLikelihoods);

  const safe = !isAdult && !isViolent;
  let reason: string | undefined;
  if (isAdult) reason = "Adult or sexually explicit content is not allowed";
  else if (isViolent) reason = "Violent or graphic content is not allowed";

  return { safe, reason, scores };
}

/** Test-only: reset memoized default client. */
export function __resetDefaultVisionClient() {
  _defaultClient = null;
}
