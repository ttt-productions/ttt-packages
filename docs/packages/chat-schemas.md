# @ttt-productions/chat-schemas

Pure schema package for chat data that must be safe to import from UI, backend, and app-data packages.

## Owns

- **The chat realtime wire contract** (`src/realtime-wire.ts`) — the single owner
  of the chat socket protocol shared by the chat React client, the chat Cloudflare
  Worker, and Cloud Functions. The socket frame envelope is `{ v, type, payload }`.
  This module owns:
  - `CHAT_SUBPROTOCOL` (`'ttt.chat.v1'`) and `CHAT_WIRE_VERSION` (`1`)
  - the frame-kind maps `CLIENT_KINDS` / `SERVER_KINDS` (the `type` discriminants)
    plus the `ClientFrameKind` / `ServerFrameKind` value types. `SERVER_KINDS`
    includes the additive v1 `SEND_REJECTED` (`'send-rejected'`) frame — every
    valid `send` now receives a correlated `ack` OR `send-rejected` naming the same
    `clientMessageId`.
  - the correlated send-rejection contract: `CHAT_SEND_REJECTION_CODES` (the closed
    code list), `CHAT_SEND_REJECTION_RETRYABLE` (the canonical retryable/terminal
    table), `ChatSendRejectedPayloadSchema` (the Zod parse boundary — refined so the
    wire `retryable` must agree with the table), and the `ChatSendRejectionCode` /
    `ChatSendRejectedPayload` types. Consumed by both the Worker (emit) and
    `chat-react` (parse). Additive — `CHAT_WIRE_VERSION` stays `1`.
  - `CHAT_CLOSE_CODES` + the `ChatCloseCode` type
  - `ChannelRefTuple` type + `ChannelRefTupleSchema` (Zod)
  - `ChatGrantScope` type + `CHAT_GRANT_AUDIENCE` (`'ttt-chat'`)
  - `MODERATION_REDACTED_TEXT`
  - the client-agreed limits `HEARTBEAT_MS`, `TYPING_COALESCE_MS`, `HISTORY_PAGE_MAX`

  Consumers import these (never re-declare them); `chat-react`'s realtime transport
  re-exports them under its historical names (`CLIENT_FRAME` / `SERVER_FRAME`) to
  keep its public surface stable.

## Boundary

This package is intentionally tiny and has no internal `@ttt-productions/*` dependencies. It exists so `ttt-core`, Cloud Functions, the chat Worker, and the chat React client can compose chat validation, cleanup, or wire behavior without importing `chat-core`'s React/upload dependency graph.

## Does not own

- Chat UI
- Composer behavior
- Upload logic
- **Any attachment/file contract.** Chat is text-only: a file belongs to the
  CONVERSATION (`ttt-core`'s `ConversationFileSchema` / `ConversationFileRef`),
  never to a message. A chat message schema that accepts an `attachment` field is
  a regression — the package contract test asserts against it.
- TTT-specific callable schemas
- **Any mention/token contract.** Chat message text is plain text; mentions are a
  Square-posts concept owned by `ttt-core` and the app, never a chat one.
- **Any reply-to contract.** There is no `ReplyToSchema`, `ReplyTo` type, or
  preview-length bound. No chat surface has an authoring affordance for replying
  to a specific message (`chat-react`'s `MessageActions` renders only
  Report/Delete; the composer's `onSend` takes text alone), so a reply pointer
  could never be populated — the machinery was removed rather than left dormant
  (DJ ruling 2026-07-29). The package contract test asserts against its return.
