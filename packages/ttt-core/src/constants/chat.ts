/**
 * Maximum chat message length (characters) used by ttt-core's chat callable
 * and system-message-action schemas for backend validation.
 *
 * Split ownership by design: chat-core owns its own UI/runtime default
 * (`MAX_CHAT_MESSAGE_LENGTH` in `chat-core/src/constants.ts`); ttt-core owns
 * the value used by callable wire validation. The values are intentionally
 * aligned at 4000; consumers wanting a different limit should override at
 * their own call site rather than expecting cross-package coordination.
 */
export const MAX_CHAT_MESSAGE_LENGTH = 4000;
