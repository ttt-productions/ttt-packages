// Server-safe barrel. React UI, hooks, and the ChatNameResolver context
// live on the "/react" subpath. Cloud Functions and other server code
// import from this barrel only.

export { MAX_CHAT_MESSAGE_LENGTH, CHAT_ATTACHMENT_STALE_AGE_MS } from "./constants.js";

export { GROUP_GAP_SEC } from "./types.js";
export type {
    ChatAttachmentStatus,
    ChatAttachment,
    ChatId,
    ChatThreadV1,
    ChatMessageV1,
    ChatAccessMode,
    ChatCoreConfig,
    ChatAttachmentConfig,
    RegisterAttachmentInput,
    RegisterAttachmentFn,
    DismissFailedAttachmentFn,
    ModerationHandlers,
    MessageRenderer,
    MessageRendererRegistry,
    ChatNameResolver,
    ChatPrewarmSenders,
} from "./types.js";

// CSS: import "@ttt-productions/chat-core/styles" in your app layout.
