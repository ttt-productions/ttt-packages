# @ttt-productions/chat-react

Chat **React UI** for TTT Productions apps: chat shell, composer, message list,
the name-resolver context, and the realtime-newest-window + infinite-older
hooks. Chat is PLAIN-TEXT-only — a conversation's files live in the consuming
app's Conversation Files surface, never in the message timeline, and message text
carries no token grammar (no mentions, no autocomplete, no chips).

Built on the pure [`@ttt-productions/chat-core`](../chat-core) package
(contracts, grouping). A non-React consumer (a Cloud Function, a script, a
future native/TV client) installs `chat-core` and pulls in none of this frontend
tree.

## Entry points

- `.` — React components, hooks, the Firebase-client adapter config types
  (`ChatCoreConfig`), and the React render types (`MessageRenderer`,
  `MessageRendererRegistry`).
- `./styles` — chat CSS. Import once in your app layout:
  `import "@ttt-productions/chat-react/styles";`

## Peers

`react`, `react-dom`, `firebase`, `@tanstack/react-query`, and `lucide-react`
are optional peers — provided by the consuming app.

## Boundary

`chat-react` does not import `ttt-core`, does not hardcode TTT origins, and does
not build TTT storage paths — it runs no upload path at all. It owns no mention
machinery either: mentions belong to the app's Square-posts surface, not to chat.
And it owns no reply-to machinery: every send path takes text alone, because the
product has no affordance for replying to a specific message.
