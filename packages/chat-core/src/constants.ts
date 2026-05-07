// Chat-domain limits and operational constants.

// Re-exported from ttt-core. Source of truth lives there so ttt-core's
// schemas can reference it without creating a circular package dependency.
export { MAX_CHAT_MESSAGE_LENGTH } from '@ttt-productions/ttt-core';

/** Age threshold after which a stale chat-attachment row becomes eligible for cleanup (1 hour). */
export const CHAT_ATTACHMENT_STALE_AGE_MS = 60 * 60 * 1000;
