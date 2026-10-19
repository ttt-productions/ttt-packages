/** Guild chat channel name — one owner for the create/update callable schemas AND the
 *  channel form. */
export const MAX_GUILD_CHAT_CHANNEL_NAME_LENGTH = 50;

/** Guild chat channel description — same single-owner rule as the name. */
export const MAX_GUILD_CHAT_CHANNEL_DESCRIPTION_LENGTH = 150;

/** How many standings and trades a guild chat channel may require — a member holding any one may read it. */
export const MAX_GUILD_CHAT_CHANNEL_REQUIRED_STANDINGS = 20;

/**
 * The ONE user-facing sentence for "the chat service itself is down right now". A chat callable that cannot reach the Cloudflare chat Worker
 * answers `unavailable` with this message, and every chat call site renders this copy
 * instead of the generic error toast — so an outage reads as an outage, on both sides of
 * the wire. Shared by the backend answer text and the client surface.
 */
export const CHAT_TEMPORARILY_UNAVAILABLE_MESSAGE =
  'Chat is temporarily unavailable. Please try again in a moment.';
