# @ttt-productions/chat-schemas

Pure schema package for chat data that must be safe to import from UI, backend, and app-data packages.

## Owns

- `ChatAttachmentSchema`
- `ReplyToSchema`
- Inferred `ChatAttachment` and `ReplyTo` types
- Server-safe chat contract constants such as `CHAT_ATTACHMENT_STALE_AGE_MS`
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
- TTT-specific callable schemas
- TTT-specific mention providers
