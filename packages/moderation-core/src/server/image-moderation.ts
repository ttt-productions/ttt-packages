import { isRejectionLikelihood, likelihoodToString } from '../likelihood.js';
import type { MediaModerationResult, ModerationLogger } from '../types.js';

import type * as vision from '@google-cloud/vision';

// The one Vision call image moderation makes; an ImageAnnotatorClient is one.
export type SafeSearchClient = Pick<vision.ImageAnnotatorClient, 'safeSearchDetection'>;

export interface ImageModerationOptions {
  rejectionLikelihoods: ReadonlySet<string>;
  logger?: ModerationLogger;
  getClient?: () => Promise<SafeSearchClient>;
}

let _defaultClient: vision.ImageAnnotatorClient | null = null;
async function defaultGetVisionClient(): Promise<vision.ImageAnnotatorClient> {
  if (_defaultClient) return _defaultClient;
  const mod = await import('@google-cloud/vision');
  _defaultClient = new mod.ImageAnnotatorClient();
  return _defaultClient;
}

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
    logger?.warn?.(
      '[moderation-core] SafeSearch returned no annotation; the image was not checked',
    );
    return {
      checked: false,
      safe: false,
      reason: 'Content moderation check did not complete',
      scores: { adult: 'UNKNOWN', violence: 'UNKNOWN', racy: 'UNKNOWN' },
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
  if (isAdult) reason = 'Adult or sexually explicit content is not allowed';
  else if (isViolent) reason = 'Violent or graphic content is not allowed';

  return { checked: true, safe, reason, scores };
}

export function __resetDefaultVisionClient() {
  _defaultClient = null;
}
