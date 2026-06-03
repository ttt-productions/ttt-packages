# @ttt-productions/chat-react

Chat **React UI** package — the React half of the chat split.

## Owns

- Chat shell, composer, message list, attachment UI, and the
  realtime-newest-window + infinite-older hooks (`useChatMessages`,
  `canAccessThread`)
- `ChatShell`/`MessageList` height modes: default is a fixed-height card
  (`h-[400px]` scroll region); `fillHeight` lays the shell out `flex flex-col h-full`
  so the message list flexes to fill a bounded-height page panel (scrolls inside)
  instead of a fixed box. The consumer gives ChatShell a bounded-height parent.
- The generic mention **UI**: autocomplete dropdown, keyboard behavior,
  composer insertion, and message-text rendering
- The name-resolver context (`ChatNameResolverProvider`, …)
- The Firebase-client adapter config types (`ChatCoreConfig`,
  `ChatAttachmentConfig`, `ChatUploadAdapter`, `ChatMentionConfig`) and the
  React render types (`MessageRenderer`, `RenderableMentionProvider`,
  `MentionResultRenderer`)
- Chat upload adapter integration through `upload-ui`

## Boundary

`chat-react` depends on the pure [`@ttt-productions/chat-core`](./chat-core.md)
plus the UI tier (`ui-core`, `file-input`, `upload-ui`, `media-viewer`,
`mobile-core`). `react`, `react-dom`, `firebase`, `@tanstack/react-query`, and
`lucide-react` are optional peers.

`chat-react` does not import `ttt-core`, does not hardcode TTT origins, and does
not build TTT storage paths. Consumers pass a chat upload adapter with opaque
origin id, upload path builder, and optional metadata builder. TTT mention
kinds, permissions, provider lists, routing, and search live in TTT code.

## Entry points

- `.` — React chat UI, hooks, adapter config types, and render types
- `./styles` — chat CSS
