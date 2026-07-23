// TTT media-processing crash-recovery policy.
//
// Generic pending-media lifecycle fields (`processingAttemptCount`,
// `processingLeaseExpiresAt`) live in `@ttt-productions/media-schemas`; the TTT
// retry policy that interprets them lives here.

/**
 * Maximum bounded processing attempts for a single pendingMedia row:
 * the first attempt plus exactly one crash/timeout retry. A row whose
 * attempts reach this ceiling is terminalized rather than reprocessed.
 */
export const MEDIA_PROCESSING_MAX_ATTEMPTS = 2;

/**
 * Processing lease duration in milliseconds. Covers the 540s function
 * timeout plus a safety margin so a live attempt is never reclaimed while
 * it may still be running.
 */
export const MEDIA_PROCESSING_LEASE_MS = 12 * 60 * 1000;
