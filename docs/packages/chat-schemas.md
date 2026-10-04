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
  - **Message revision kinds.** `CHAT_MESSAGE_REVISION_KINDS` / `ChatMessageRevisionKind` /
    `ChatMessageRevisionKindSchema` (`delete`, `moderate`, `edit`, `restore`): what a revision
    does to a message. A message's effective state is its highest revision's kind, so a later
    `restore` supersedes an earlier `moderate` or `delete`. The room stores them and sends them on
    a `revision` frame and on each row; chat-react and ttt-core's context-read answer type with them.
  - **The channel socket's client frame payloads**, which the Worker parses before acting
    and the client sends: `ChatSendPayloadSchema` (`clientMessageId` + `text`; the text's
    length is judged after the parse, so an over-long text gets a `too-long` rejection naming
    the parsed id), `ChatReadAckPayloadSchema` (`readSeq`, whole and non-negative; `focused`,
    false when absent), `ChatHistoryPayloadSchema` (`beforeSeq`, positive or absent; `limit`
    at most and by default `HISTORY_PAGE_MAX`), and `ChatResumePayloadSchema` (`afterSeq`,
    the last seq the client holds, or absent). Unknown keys are stripped, so a client one
    release ahead still parses.

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
  - **Who a signed call is for.** Every internal call is signed with edge-protocol-core's
    internal auth. `CHAT_INTERNAL_CALL_DIRECTIONS` names the two directions — `to-room` (the
    server's calls to the Worker's rooms) and `to-server` (a room's report) — and
    `chatInternalAudience(direction, env)` gives each direction and environment its own audience,
    `ttt-chat:{direction}:{env}` (rooted in `CHAT_GRANT_AUDIENCE`). Both directions share one
    secret, so the distinct audience is what keeps a signature made for one direction from
    verifying in the other. The signer and the verifier of each direction call the same builder.
  - **The server's call bodies**, each parsed after its signature is verified (strict, so an
    unknown or coerced field is refused rather than guessed):
    `ChatSyncApplyRequestSchema` — one versioned sync event (`eventId`, the room `targetDo`,
    `kind` from `CHAT_SYNC_APPLY_KINDS`: `channelAuth` / `accountAccess` / `config`, `version`,
    `payload` as a JSON object, `tombstone`, `payloadHash`); `ChatOutboxAppendRequestSchema` — one
    server-originated message (`commandId`, `kind` from `CHAT_OUTBOX_COMMAND_KINDS`: `userMsg` /
    `systemMsg`, the room `threadRef`, `payload` as `ChatServerMessagePayloadSchema`);
    `ChatWordListSnapshotSchema` — the global word list (`wordListVersion`, `words`, and `hash`,
    which edge-protocol-core's `hashStringSet` computes and every reader recomputes). Ids are bounded
    by `CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH`, digests by `CHAT_DIGEST_MAX_LENGTH`, rooms by
    `CHAT_ROOM_TARGET_MAX_LENGTH`.
  - **A server-written message.** `ChatServerMessagePayloadSchema` (`senderId`, `text` within
    `CHAT_MESSAGE_TEXT_MAX_LENGTH`, optional `referencedUids`; strict) is the message part of a
    server-originated outbox command; the room stores `referencedUids` on the row beside
    `senderUid`, returns it with the row, and rewrites it on an account's anonymization.
  - **A room's parked deliveries.** A chat room (`CHAT_ROOM_KINDS`: `channel`, `inbox`)
    that parks an outbox delivery reports it to the server through a signed `to-server` call whose
    body is `ChatParkedDeliveryReportSchema` — `targetDo` (the room's address), `roomKind`,
    `eventId` (the parked row), `deliveryKind`, `roomAttemptCount`, `roomLastError`, `parkedAt` —
    sent as `CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE` (`application/octet-stream`, so the receiving
    platform buffers raw bytes and parses nothing before the signature is verified) and read within
    `CHAT_PARKED_DELIVERY_REPORT_MAX_BODY_BYTES` (a package test proves the largest valid report
    fits). The signed operation id is `chatParkedDeliveryReportOperationId(report)` — the report's
    `eventId` — and the receiver refuses a body naming another. An operator replay asks the room,
    with `ChatParkedDeliveryReplayRequestSchema` (`targetDo`, `eventId`), to put the delivery back on
    its outbox; the room answers `ChatParkedDeliveryReplayResultSchema` — `requeued`, or
    `not-parked` when it holds no parked delivery by that id, so a repeated replay is a no-op.

- **A chat room's address** (`src/room-address.ts`) — the one build and parse the server and the
  chat Worker share. The Worker derives a room's Durable Object id from it and the server signs it
  into every internal call. A conversation's room is `{product}:{env}:channel:{kind}:{id}` and an
  inbox is `{product}:{env}:inbox:{uid}`; existing rooms live under these exact strings, so the
  format is fixed. `ChatRoomNamespace` (`{ product, env }`) is the app's — the package names no
  product — and `ChatRoom` is `{ kind: 'channel', ref }` or `{ kind: 'inbox', uid }`.
  `buildChatRoomAddress(namespace, room)` throws a `RangeError` for anything that would not parse
  back to the same room: an empty or `:`-holding product or env, a namespace longer than
  `CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH` allows, a reference `ChatConversationRefSchema` refuses, or an
  inbox uid that is empty, holds `:`, or is longer than `CHAT_ACCOUNT_ID_MAX_LENGTH`. So every
  address it returns fits `CHAT_ROOM_TARGET_MAX_LENGTH` (which derives from the conversation
  reference's own bounds plus the prefix bound) and can be reported. `parseChatRoomAddress(address,
  namespace)` returns the room, or null for another product or environment, an unknown room kind, or
  an invalid uid or conversation; a conversation's id is everything after the fourth `:`, since its
  kind never holds one.

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
