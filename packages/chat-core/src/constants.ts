// Chat-domain limits and operational constants.

/**
 * Maximum chat message text length (characters). Consumer apps may override
 * by passing a custom value through `ChatCoreConfig`; this constant is the
 * package default and is also what chat-core's own internal schemas use.
 */
export const MAX_CHAT_MESSAGE_LENGTH = 4000;

/** Age threshold after which a stale chat-attachment row becomes eligible for cleanup (1 hour). */
export const CHAT_ATTACHMENT_STALE_AGE_MS = 60 * 60 * 1000;
