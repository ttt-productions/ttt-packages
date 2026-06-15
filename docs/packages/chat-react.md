# @ttt-productions/chat-react

Chat **React UI** package — the React half of the chat split.

## Owns

- Chat shell, composer, message list, attachment UI, and the
  realtime-newest-window + infinite-older hooks (`useChatMessages`,
  `canAccessThread`)
- `ChatShell`/`MessageList` height modes: a default fixed-height card with an
  internal scroll region, or a `fillHeight` mode that flexes to fill a
  bounded-height page panel (scrolling inside) instead of a fixed box. The
  consumer gives `ChatShell` a bounded-height parent.
- The generic mention **UI**: autocomplete dropdown, keyboard behavior,
  composer insertion, and message-text rendering
- The name-resolver context (`ChatNameResolverProvider`, …)
- The Firebase-client adapter config types (`ChatCoreConfig`,
  `ChatAttachmentConfig`, `ChatUploadAdapter`, `ChatMentionConfig`) and the
  React render types (`MessageRenderer`, `RenderableMentionProvider`,
  `MentionResultRenderer`)
- A discriminated **transport config** (chat-edge-rebuild P1): `ChatCoreConfig`
  carries an optional `transport: ChatTransportMode` (`'firestore' | 'realtime'`,
  default `'firestore'` so existing call sites are unchanged) plus an optional
  `realtime: ChatRealtimeTransportConfig` (opaque DO-socket handle; the concrete
  client lands with the chat Worker, P2). On the `realtime` transport, data
  access is enforced by the DO grant, so `accessMode` becomes **presentation-only**.
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
