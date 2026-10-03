# @ttt-productions/chat-core

Pure chat contracts and logic package. **No React, no Firebase.**

## Owns

- Message/thread contract types that are not React-shaped (`ChatMessageV1`,
  `ChatThreadV1`, `ChatId`, `ModerationHandlers`, `ChatPrewarmSenders`).
  `ChatMessageV1` is TEXT-only — there is no attachment field or attachment-send
  contract; a conversation's files are owned by the consuming app's Conversation
  Files surface. It carries no `replyTo` field either (see "Not owned" below).
  `ChatThreadV1` carries no access list: who may read or write a conversation is
  the consuming app's decision, handed to the UI as one `allowed` fact
  (`chat-react`'s `ChatCoreConfig.allowed`).
- **Sender-name resolution.** `ChatNameResolver = (senderId) => ChatNameResolution`,
  where `ChatNameResolution` is `{ status: 'resolved'; name }`,
  `{ status: 'pending' }`, `{ status: 'unavailable' }`, or
  `{ status: 'failed'; retry }`. The resolver reads the app's own cache during
  render; only `resolved` carries a name, and the UI renders the other three
  through the app's slot rather than inventing a name.
- Message grouping helper (`isContinuation`) and `GROUP_GAP_SEC`. There is no
  message-length constant here: the one send-text bound is
  `CHAT_MESSAGE_TEXT_MAX_LENGTH` in `chat-schemas`.

## Boundary

`chat-core` has **zero internal runtime dependencies** — no
`@ttt-productions/*` edge at all — and pulls in no React, Firebase, or UI
packages, so a Cloud Function, script, or future native/TV client can consume
the contracts without dragging in the frontend tree.

`chat-core` does not import `ttt-core`.

## Not owned — chat message text is PLAIN text

There is no mention/token grammar in chat: no parser, no serializer, no
`@`-token wire format, and no mention provider or autocomplete contract. Chat
message text is stored and rendered verbatim. Mentions are a **Square posts**
concept owned by the consuming app (`ttt-core`'s `Mention` / `MentionType`
atoms and the app's own implementation) — chat never had a product reason for
them, so the machinery is gone rather than dormant.

## Not owned — no reply-to pointer

`ChatMessageV1` has no `replyTo` field and this package declares no reply
contract. The product has no authoring affordance for replying to a specific
message on any chat surface — `chat-react`'s `MessageActions` renders only
Report/Delete, and the composer's `onSend` takes text alone — so a reply pointer
could never be populated by a user action. It was removed rather than left
dormant.

## Related packages

- The chat **React UI**, hooks, Firebase-client adapter config, and React render
  types live in [`@ttt-productions/chat-react`](./chat-react.md).
- Pure chat **schemas** are canonical in
  [`@ttt-productions/chat-schemas`](./chat-schemas.md).

## Entry points

- `.` — pure contracts, grouping helpers, constants
