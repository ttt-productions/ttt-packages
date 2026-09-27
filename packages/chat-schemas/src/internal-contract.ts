// The chat internal-endpoint contract: the signed calls Cloud Functions makes to the chat Worker
// (sync apply, outbox append, word-list publish, moderation, context reads, history anonymization).

/**
 * The largest body, in bytes, a chat internal endpoint accepts. The chat Worker reads every
 * internal request through edge-protocol-core's bounded reader with this budget before it verifies
 * the signature (ARCH-005), and the Functions signer refuses to send a larger body, so both sides
 * hold one number.
 */
export const CHAT_INTERNAL_BODY_MAX_BYTES = 262_144;
