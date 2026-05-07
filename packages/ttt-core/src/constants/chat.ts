/**
 * Chat-related constants shared between ttt-core (schemas) and chat-core (UI/runtime).
 *
 * These live here so ttt-core's schemas/chat.ts and schemas/system-message-actions.ts
 * can use them without depending on chat-core (which would create a circular package
 * dependency — chat-core already depends on ttt-core).
 *
 * chat-core re-exports these constants from its public surface so existing chat-core
 * consumers see no change.
 */
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
