// Pure chat-core barrel. No React, no Firebase (client or admin) reachable from
// here — safe for Cloud Functions, scripts, and future native/TV clients that
// only need the parser, contracts, and grouping logic.
//
// The chat React UI, hooks, Firestore-client adapter config, and render types
// live in @ttt-productions/chat-react. Pure chat schemas live in
// @ttt-productions/chat-schemas.

export { MAX_CHAT_MESSAGE_LENGTH } from "./constants.js";

export { GROUP_GAP_SEC } from "./types.js";
export { isContinuation } from "./grouping.js";
export type {
    ChatAttachment,
    ChatId,
    ChatThreadV1,
    ChatMessageV1,
    ChatAccessMode,
    SendAttachmentInput,
    SendAttachmentFn,
    ModerationHandlers,
    ChatNameResolver,
    ChatPrewarmSenders,
} from "./types.js";

export type {
    MentionRef,
    ParsedSegment,
    MentionProvider,
    RecentMentionsAdapter,
    MentionAnchor,
} from "./mentions/types.js";
export { parseMentionTokens, formatMentionToken } from "./mentions/parser.js";
