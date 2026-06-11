"use client";

// @ttt-productions/chat-react — chat React UI, hooks, the Firebase-client
// adapter config types, and React render types. Depends on the pure
// @ttt-productions/chat-core for contracts, parser, and grouping.
//
// Apps import chat CSS via "@ttt-productions/chat-react/styles".

// React-coupled config + render types (previously on chat-core root).
export type {
  ChatCoreConfig,
  ChatAttachmentConfig,
  ChatUploadAdapter,
  ChatMentionConfig,
  MessageRenderer,
  MessageRendererRegistry,
  RenderableMentionProvider,
  MentionResultRenderer,
} from "./types.js";

// Attachment-URL resolver context (render-time URL building from mediaAssetId).
export type {
  ChatAttachmentUrlResolver,
  ChatAttachmentUrlProviderProps,
} from "./context/ChatAttachmentUrlContext.js";
export {
  ChatAttachmentUrlProvider,
  useChatAttachmentUrlResolver,
} from "./context/ChatAttachmentUrlContext.js";

// Name-resolver context.
export type { ChatNameResolverProviderProps } from "./context/ChatNameResolverContext.js";
export {
  ChatNameResolverProvider,
  useChatNameResolver,
  useOptionalChatNameResolver,
  useResolvedSenderName,
} from "./context/ChatNameResolverContext.js";

export type { UseChatMessagesResult } from "./hooks/useChatMessages.js";
export { useChatMessages } from "./hooks/useChatMessages.js";
export { canAccessThread } from "./hooks/useChatThreadAccess.js";

export type { ChatShellProps } from "./ui/ChatShell.js";
export { ChatShell } from "./ui/ChatShell.js";
export { MessageList } from "./ui/MessageList.js";
export type { ComposerProps } from "./ui/Composer.js";
export { Composer } from "./ui/Composer.js";
export type { MessageItemDefaultProps } from "./ui/MessageItemDefault.js";
export { MessageItemDefault } from "./ui/MessageItemDefault.js";
export { MessageActions, ThreadActions } from "./ui/menus.js";
export { MessageText, type MessageTextProps } from "./mentions/MessageText.js";
export {
  MentionAutocomplete,
  type MentionAutocompleteProps,
} from "./mentions/MentionAutocomplete.js";
export {
  useMentionAutocomplete,
  type UseMentionAutocompleteArgs,
  type UseMentionAutocompleteResult,
  type AutocompleteState,
  type AutocompleteResultGroup,
} from "./mentions/use-mention-autocomplete.js";
