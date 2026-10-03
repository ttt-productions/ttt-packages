/** Guild chat channel name — one owner for the create/update callable schemas AND the
 *  channel form (whose zod previously carried its own 50 while the backend allowed 100). */
export const MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH = 50;

/** Guild chat channel description — same single-owner rule as the name. */
export const MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH = 150;

/**
 * The ONE user-facing sentence for "the chat service itself is down right now"
 * (DJ ruling 2026-07-30). A chat callable that cannot reach the Cloudflare chat Worker
 * answers `unavailable` with this message, and every chat call site renders this copy
 * instead of the generic error toast — so an outage reads as an outage, on both sides of
 * the wire. Shared by the backend answer text (functions chat-internal-call) and the
 * client surface (src/lib/chat-realtime), which previously carried two hand-synced copies.
 */
export const CHAT_TEMPORARILY_UNAVAILABLE_MESSAGE =
  'Chat is temporarily unavailable. Please try again in a moment.';
