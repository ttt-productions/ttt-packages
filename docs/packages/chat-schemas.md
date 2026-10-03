# @ttt-productions/chat-schemas

Pure schema package for chat data that must be safe to import from UI, backend, and app-data packages.

## Owns

- **The chat realtime wire contract** (`src/realtime-wire.ts`) — the single owner
  of the chat socket protocol shared by the chat React client, the chat Cloudflare
  Worker, and Cloud Functions. The socket frame envelope is `{ v, type, payload }`.
  This module owns:
  - `CHAT_SUBPROTOCOL` (`'ttt.chat.v1'`) and `CHAT_WIRE_VERSION` (`1`)
  - the frame-kind maps `CLIENT_KINDS` / `SERVER_KINDS` (the `type` discriminants)
    plus the `ClientFrameKind` / `ServerFrameKind` value types.
  - **The neutral conversation reference.** `ChatConversationRef` = `{ kind, id }`
    and `ChatConversationRefSchema` (strict): `kind` is a short identifier (a
    lowercase letter, then letters and digits, at most
    `CHAT_CONVERSATION_KIND_MAX_LENGTH`), so it can never hold a separator; `id` is
    opaque, non-empty, at most `CHAT_CONVERSATION_ID_MAX_LENGTH`, with no control
    characters — it may contain `/` or `:` when the app composes it from several
    ids. The chat runtimes never interpret either: the consuming app maps its own
    conversations onto the reference and decides who may take part.
  - **The grant scope.** `ChatGrantScope` = `{ kind: 'channel'; channelRef:
    ChatConversationRef } | { kind: 'inbox'; uid }`, its parse boundary
    `ChatGrantScopeSchema`, and `CHAT_GRANT_AUDIENCE` (`'ttt-chat'`). Cloud Functions
    signs the scope after the app's authorization check; the Worker parses it with the
    schema after verifying the signature. `ChatGrantClaimsSchema` / `ChatGrantClaims` is the
    whole grant payload (`v`, `typ: 'grant'`, `aud`, `env`, `uid`, `scope`, `iat`, `exp`; strict,
    `exp` after `iat`): the signer types its claims with it and the Worker parses the verified
    payload with it, then checks `env` and the times against its own environment and clock.
  - **Server-written messages.** `CHAT_SYSTEM_SENDER_ID` (`'system'`) is the sender of a line
    the server writes; a member's send is always attributed to its verified account, so only the
    server writes it. `ChatReferencedUidsSchema` (at most `CHAT_MESSAGE_REFERENCED_UIDS_MAX` ids,
    each at most `CHAT_ACCOUNT_ID_MAX_LENGTH`) holds the accounts a server-written message's text
    refers to — beside the text, never inside it, so the room's account anonymization rewrites
    them like a sender.
  - **The send bounds.** `CHAT_MESSAGE_TEXT_MAX_LENGTH` (4000 UTF-16 code units — what
    a zod `.max()` and a textarea `maxLength` both count), the one text bound the
    composer, the Worker, and an app send schema share; `CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH`
    and `ChatClientMessageIdSchema`, which the Worker parses before it judges the text.
  - **The correlated send rejection.** Every valid `send` receives an `ack` or a
    `send-rejected` naming the same `clientMessageId`: `CHAT_SEND_REJECTION_CODES`
    (the closed list — `too-long` included), `CHAT_SEND_REJECTION_RETRYABLE` (the
    canonical retryable/terminal table; `archived`, `deleted`, `blocked-word`, and
    `too-long` are terminal), `ChatSendRejectedPayloadSchema` (refined so the wire
    `retryable` must agree with the table), and the `ChatSendRejectionCode` /
    `ChatSendRejectedPayload` types.
  - **The correlated mark-read.** An inbox `mark-read` carries
    `ChatMarkReadPayloadSchema` (`channelRef` — the inbox registry's own key, at most
    `CHAT_INBOX_CHANNEL_REF_MAX_LENGTH` — and a client-minted `requestId`,
    `ChatRequestIdSchema`). The inbox runtime answers each one whose `requestId` parsed
    with exactly one `SERVER_KINDS.MARK_READ_RESULT` frame
    (`ChatMarkReadResultPayloadSchema`: `{ requestId, ok: true }` or `{ requestId, ok:
    false, code }`, `code` from `CHAT_MARK_READ_FAILURE_CODES`).
  - `CHAT_CLOSE_CODES` + the `ChatCloseCode` type
  - `MODERATION_REDACTED_TEXT`
  - the client-agreed limits `HEARTBEAT_MS`, `TYPING_COALESCE_MS`, `HISTORY_PAGE_MAX`

  Consumers import these (never re-declare them); `chat-react`'s realtime transport
  re-exports the frame-kind maps under its historical names (`CLIENT_FRAME` /
  `SERVER_FRAME`).

- **The chat internal-endpoint contract** (`src/internal-contract.ts`):
  - `CHAT_INTERNAL_BODY_MAX_BYTES` (256 KiB), the largest body a signed chat internal
    endpoint (the Cloud Functions → chat Worker calls) accepts. The chat Worker reads each
    internal request through edge-protocol-core's `readBoundedBody` with it before verifying
    the signature (ARCH-005), and the Cloud Functions signer refuses a larger body, so the two
    sides import one value. It is sized well above the largest bounded internal body (an outbox
    message at the message-length cap, a history-swap chunk list); the curated word-list publish
    is the one body with no size cap of its own, and a list that outgrows the budget is refused
    at publish.
  - **A server-written message.** `ChatServerMessagePayloadSchema` (`senderId`, `text` within
    `CHAT_MESSAGE_TEXT_MAX_LENGTH`, optional `referencedUids`; strict) is the message part of a
    server-originated outbox command; the room stores `referencedUids` on the row beside
    `senderUid`, returns it with the row, and rewrites it on an account's anonymization.
  - **A room's parked deliveries.** A chat room (`CHAT_ROOM_KINDS`: `channel`, `inbox`)
    that parks an outbox delivery reports it to the server through a signed call whose body is
    `ChatParkedDeliveryReportSchema` — `targetDo` (the Worker's own internal-call address of
    the room), `roomKind`, `eventId` (the parked row), `deliveryKind`, `roomAttemptCount`,
    `roomLastError`, `parkedAt` — read within `CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES`
    before the signature is verified (a package test proves the largest valid report fits). The
    room address bound `CHAT_ROOM_TARGET_MAX_LENGTH` derives from the conversation reference's own
    bounds plus `CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH`, so every valid conversation's room can be
    reported. An
    operator replay asks the room, with `ChatParkedDeliveryReplayRequestSchema` (`targetDo`,
    `eventId`), to put the delivery back on its outbox; the room answers
    `ChatParkedDeliveryReplayResultSchema` — `requeued`, or `not-parked` when it holds no
    parked delivery by that id, so a repeated replay is a no-op.

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
  could never be populated — the machinery was removed rather than left dormant.
  The package contract test asserts against its return.
