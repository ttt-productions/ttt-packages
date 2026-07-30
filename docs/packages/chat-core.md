# @ttt-productions/chat-core

Pure chat contracts and logic package. **No React, no Firebase.**

## Owns

- Message/thread contract types that are not React-shaped (`ChatMessageV1`,
  `ChatThreadV1`, `ChatId`, `ChatAccessMode`, `ModerationHandlers`,
  `ChatNameResolver`, …). `ChatMessageV1` is TEXT-only — there is no attachment
  field or attachment-send contract; a conversation's files are owned by the
  consuming app's Conversation Files surface. It carries no `replyTo` field
  either (see "Not owned" below).
- Message grouping helper (`isContinuation`) and package constants
  (`MAX_CHAT_MESSAGE_LENGTH`, `GROUP_GAP_SEC`)

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
dormant (DJ ruling 2026-07-29).

## Related packages

- The chat **React UI**, hooks, Firebase-client adapter config, and React render
  types live in [`@ttt-productions/chat-react`](./chat-react.md).
- Pure chat **schemas** are canonical in
  [`@ttt-productions/chat-schemas`](./chat-schemas.md).

## Entry points

- `.` — pure contracts, grouping helpers, constants
