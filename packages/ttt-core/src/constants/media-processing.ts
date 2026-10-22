export const MEDIA_PROCESSING_MAX_ATTEMPTS = 2;

// Exceeds the processor's 540 s function timeout, so a live attempt is never reclaimed.
export const MEDIA_PROCESSING_LEASE_MS = 12 * 60 * 1000;
