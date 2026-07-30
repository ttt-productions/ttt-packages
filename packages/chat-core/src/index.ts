// Pure chat-core barrel. No React, no Firebase (client or admin) reachable from
// here — safe for Cloud Functions, scripts, and future native/TV clients that
// only need the contracts and grouping logic. Zero @ttt-productions/* deps.
//
// The chat React UI, hooks, Firestore-client adapter config, and render types
// live in @ttt-productions/chat-react. The realtime wire contract and the pure
// chat Zod schemas live in @ttt-productions/chat-schemas.

export { MAX_CHAT_MESSAGE_LENGTH } from "./constants.js";

export { GROUP_GAP_SEC } from "./types.js";
export { isContinuation } from "./grouping.js";
export type {
    ChatId,
    ChatThreadV1,
    ChatMessageV1,
    ChatAccessMode,
    ModerationHandlers,
    ChatNameResolver,
    ChatPrewarmSenders,
} from "./types.js";
