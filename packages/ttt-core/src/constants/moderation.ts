// Content moderation constants shared between frontend and backend

/** Cloud Vision SafeSearch likelihood values that trigger content rejection. */
export const REJECTION_LIKELIHOODS = new Set(['LIKELY', 'VERY_LIKELY']);

/** Minimum character length for text to be sent to the moderation service. */
export const TEXT_MODERATION_MIN_LENGTH = 3;

/**
 * `pendingMedia.moderationOverride` value set ONLY by the appeal-review backend
 * (`reviewContentAppeal`, decision `approved`) when re-queuing rejected media.
 * A human admin approving an appeal is an override of the automated Vision/VI
 * adult-content judgment — the pipeline must NOT re-run that classifier (it
 * would re-reject and silently defeat the approval). Scope of the bypass is the
 * Vision/VI adult-content check ONLY; PhotoDNA/CSAM scanning is orthogonal and
 * is never skipped. The field is server-set: `pendingMedia` is callable-only in
 * firestore.rules and `startUpload` never writes it.
 */
export const MODERATION_OVERRIDE_ADMIN_APPEAL_APPROVED = 'admin-appeal-approved';
