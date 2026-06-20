// Content moderation constants shared between frontend and backend

/** Cloud Vision SafeSearch likelihood values that trigger content rejection. */
export const REJECTION_LIKELIHOODS = new Set(['LIKELY', 'VERY_LIKELY']);

/** Minimum character length for text to be sent to the moderation service. */
export const TEXT_MODERATION_MIN_LENGTH = 3;
