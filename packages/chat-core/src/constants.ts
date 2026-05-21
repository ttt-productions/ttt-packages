// Chat-domain limits and operational constants.

/**
 * Maximum chat message text length (characters). Consumer apps may override
 * by passing a custom value through `ChatCoreConfig`; this constant is the
 * package default and is also what chat-core's own internal schemas use.
 */
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
