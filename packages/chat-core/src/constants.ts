// Chat-domain limits and operational constants.

/** Maximum length for a chat message body, including admin-support message text. */
export const MAX_CHAT_MESSAGE_LENGTH = 4000;

/** Age threshold after which a stale chat-attachment row becomes eligible for cleanup (1 hour). */
export const CHAT_ATTACHMENT_STALE_AGE_MS = 60 * 60 * 1000;
