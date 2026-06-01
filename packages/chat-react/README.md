# @ttt-productions/chat-react

Chat **React UI** for TTT Productions apps: chat shell, composer, message list,
attachment UI, the generic mention autocomplete UI, the name-resolver context,
and the realtime-newest-window + infinite-older hooks.

Built on the pure [`@ttt-productions/chat-core`](../chat-core) package
(contracts, mention parser/serializer, grouping). A non-React consumer (a Cloud
Function, a script, a future native/TV client) installs `chat-core` and pulls
in none of this frontend tree.

## Entry points

- `.` — React components, hooks, the Firebase-client adapter config types
  (`ChatCoreConfig`, `ChatAttachmentConfig`, `ChatUploadAdapter`,
  `ChatMentionConfig`), and the React render types (`MessageRenderer`,
  `RenderableMentionProvider`, `MentionResultRenderer`).
- `./styles` — chat CSS. Import once in your app layout:
  `import "@ttt-productions/chat-react/styles";`

## Peers

`react`, `react-dom`, `firebase`, `@tanstack/react-query`, and `lucide-react`
are optional peers — provided by the consuming app.

## Boundary

`chat-react` does not import `ttt-core`, does not hardcode TTT origins, and does
not build TTT storage paths. Consumers pass a chat upload adapter with opaque
origin id, upload path builder, and optional metadata builder. TTT mention
kinds, permissions, provider lists, routing, and search live in TTT code.
