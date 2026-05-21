// Server-safe barrel. React UI, hooks, and the ChatNameResolver context
// live on the "/react" subpath. Cloud Functions and other server code
// import from this barrel only.

export { MAX_CHAT_MESSAGE_LENGTH } from "./constants.js";

export { GROUP_GAP_SEC } from "./types.js";
export { isContinuation } from "./grouping.js";
export type {
    ChatAttachment,
    ChatId,
    ChatThreadV1,
    ChatMessageV1,
    ChatAccessMode,
    ChatCoreConfig,
    ChatAttachmentConfig,
    SendAttachmentInput,
    SendAttachmentFn,
    ModerationHandlers,
    MessageRenderer,
    MessageRendererRegistry,
    ChatNameResolver,
    ChatPrewarmSenders,
    ChatMentionConfig,
} from "./types.js";

export type {
    MentionRef,
    ParsedSegment,
    MentionProvider,
    RecentMentionsAdapter,
    MentionAnchor,
} from "./mentions/types.js";
export { parseMentionTokens, formatMentionToken } from "./mentions/parser.js";

// CSS: import "@ttt-productions/chat-core/styles" in your app layout.
