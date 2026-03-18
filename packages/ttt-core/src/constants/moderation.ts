// Content moderation constants shared between frontend and backend

/** Perspective API rejection thresholds. Scores above these trigger rejection. */
export const PERSPECTIVE_THRESHOLDS = {
  severeToxicity: 0.7,
  identityAttack: 0.7,
  threat: 0.7,
  toxicity: 0.85,
} as const;

/** Cloud Vision SafeSearch likelihood values that trigger content rejection. */
export const REJECTION_LIKELIHOODS = new Set(['LIKELY', 'VERY_LIKELY']);

/** Minimum character length for text to be sent to the moderation service. */
export const TEXT_MODERATION_MIN_LENGTH = 3;
