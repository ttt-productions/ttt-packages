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
- The attachment **media-component injection** context
  (`ChatAttachmentMediaProvider` / `useChatAttachmentMediaComponent`, optional):
  the app hands chat its own display-path wrapper (recovery adapter, custom
  audio player chrome) as a `ComponentType<MediaPreviewProps>`, so chat
  attachments ride the SAME display pipeline as every other app surface. When
  no provider is present the default renderer uses the package's bare
  `MediaViewer` — pre-injection behavior, unchanged. Text attachments always
  render the download link (never the media component).
- The Firebase-client adapter config types (`ChatCoreConfig`,
  `ChatAttachmentConfig`, `ChatUploadAdapter`, `ChatMentionConfig`) and the
  React render types (`MessageRenderer`, `RenderableMentionProvider`,
  `MentionResultRenderer`)
- A discriminated **transport config** (chat-edge-rebuild P1): `ChatCoreConfig`
  carries an optional `transport: ChatTransportMode` (`'firestore' | 'realtime'`,
  default `'firestore'` so existing call sites are unchanged) plus an optional
  `realtime: ChatRealtimeTransportConfig` (the DO-socket handle). On the `realtime`
  transport, data access is enforced by the DO grant, so `accessMode` becomes
  **presentation-only**.
- The **realtime (Cloudflare Durable Object) transport CLIENT** (`src/realtime/`)
  — the client half of the `ttt-master-app/chat-worker` wire protocol. See the
  "Realtime transport" section below. The FIRESTORE transport stays the unchanged
  default (admin-support threads stay firestore permanently).
- Chat upload adapter integration through `upload-ui`

## Realtime transport

The realtime transport is the client for the chat Worker's Durable Objects
(Contract A connection + Contract C wire protocol). It is GENERIC — it imports
the generic [`@ttt-productions/realtime-core`](./realtime-core.md) primitives
(reconnect/resume controller, versioned-apply) and NEVER imports `ttt-core` or
the chat Worker. The wire shapes (`{ v, type, payload }` frames, close codes,
`MessageRow`) are mirrored from `ttt-master-app/chat-worker/src` by hand; neither
side imports the other. The app injects everything app-specific (the grant
provider, the endpoint, the channel ref).

**Pieces** (all under `src/realtime/`, re-exported from the package root):

- `createRealtimeChatClient({ endpoint, channelRef, threadId, currentUserId,
  grantProvider, socketFactory?, timers?, reconnect? })` → a `RealtimeChatClient`
  (one per thread). Put it on `config.realtime.client`. Drives ONE channel socket:
  subprotocol auth, optimistic send keyed by `clientMessageId` reconciled on the
  server `seq`, explicit read acks, ≥2 s-coalesced typing, presence
  subscribe/unsubscribe, a 20 s heartbeat, reconnect→resume (resume cursor →
  authoritative snapshot → live deltas), epoch-aware history pagination (page ≤50),
  4401 auth-expiry re-grant ONCE, 4403 revoke = stop, teardown on `close()`.
- `createInboxClient({ endpoint, currentUserId, grantProvider, ... })` → an
  `InboxClient` (one per USER, mounted once at the dock — NOT per thread). A
  SEPARATE socket scoped `inbox`; mirrors the DO's `{ registry, hasUnread }`
  snapshot (active entries only) into an observable store. Dots only, no counts.
- `useRealtimeChatMessages(client)` → the same result shape as `useChatMessages`
  (the firestore hook) plus realtime extras (`status`, `typing`, `presence`,
  `send`, `readAck`, `signalTyping`). Connects on mount; tears every socket down
  on unmount OR when the client identity changes (the auth-user-switch teardown
  key — pass a NEW client for a new uid).
- `ChatShell` dispatches on `config.transport`: `'realtime'` uses the realtime
  hook + socket send; the default (`undefined`/`'firestore'`) is byte-for-byte the
  previous firestore behavior. `onSend` is OPTIONAL on the realtime transport (the
  socket send is authoritative; a provided `onSend` is still called as an analytics
  mirror).

**Auth (Contract A).** The grant token is offered as the SECOND WebSocket
subprotocol (`Sec-WebSocket-Protocol: ttt.chat.v1, <grant-token>`) — never in the
URL. The app's `grantProvider` wraps its `mintChatGrant` callable (channel scope
for `createRealtimeChatClient`, inbox scope for `createInboxClient`), caches to a
React Query `staleTime < grant exp`, and returns a FRESH token when re-invoked
(the 4401 re-grant). Cookie + grant + Origin are validated by the Worker BEFORE
accept; this client never sees an unauthenticated socket.

**Testing.** `socketFactory` + `timers` are injected, so the whole transport is
unit-tested against a MOCK socket and a fake clock with no real network/timers
(`__tests__/realtime/`). Coverage: connect+auth handshake, optimistic send + seq
reconcile, read-ack, typing coalescing, presence, heartbeat, history pagination,
reconnect+resume (snapshot then delta), 4401 re-grant (once), 4403 stop, grant-mint
failure backoff, inbox unread projection, and auth-switch teardown.

**Wire details ASSUMED / not yet confirmable against the Worker** (review these):
- Attachment metadata: the DO `MessageRow` carries only the attachment LIFECYCLE
  (`attachmentState` + `attachmentMeta.mediaAssetId`), NOT the full `ChatAttachment`
  (id/name/size/storagePath). The client surfaces the placeholder state via
  `message.meta.attachmentState`; the full attachment-saga projection (P5/P6) will
  populate a real `attachment`. The render-time URL always comes from
  `mediaAssetId` via the attachment-URL resolver context (no stored URLs).
- Per-row inbox unread dots: the current inbox DO snapshot exposes a single
  `hasUnread` boolean (the dock dot) + the active registry; it does NOT enumerate
  which entries are unread. `channelHasUnread(ref)` reads a per-entry `unread` flag
  IF the snapshot carries one (forward-compatible) and otherwise returns false —
  the dock dot still lights. If per-row dots are required at launch, the inbox DO
  snapshot must add a per-entry `unread` field.
- The channel `resume` frame sends `{ afterSeq }` (the client's resume cursor). The
  DO's `resume` handler honors it via `resumeSince()` and returns
  `{ lastMessageSeq, readSeq, resync, delta }` — a real delta when the gap is
  within the resume backlog (≤500 messages); a gap beyond that is treated as a
  tail-behind and the client pulls a history page instead. Confirmed against
  `channel-do.ts`.
- Read-ack focus: the client sends `{ readSeq, focused }`; the DO reads
  `payload.focused`. Confirmed against `channel-do.ts`.

## Boundary

`chat-react` depends on the pure [`@ttt-productions/chat-core`](./chat-core.md)
plus the generic [`@ttt-productions/realtime-core`](./realtime-core.md) and the UI
tier (`ui-core`, `file-input`, `upload-ui`, `media-viewer`, `mobile-core`).
`react`, `react-dom`, `firebase`, `@tanstack/react-query`, and `lucide-react` are
optional peers. The realtime transport uses a global `WebSocket` (overridable via
an injected `socketFactory`).

`chat-react` does not import `ttt-core`, does not hardcode TTT origins, and does
not build TTT storage paths. Consumers pass a chat upload adapter with opaque
origin id, upload path builder, and optional metadata builder. TTT mention
kinds, permissions, provider lists, routing, and search live in TTT code.

## Entry points

- `.` — React chat UI, hooks, adapter config types, and render types
- `./styles` — chat CSS
