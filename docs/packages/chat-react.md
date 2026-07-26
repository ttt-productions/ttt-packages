# @ttt-productions/chat-react

Chat **React UI** package — the React half of the chat split.

## Owns

- Chat shell, composer, message list, and the realtime-newest-window +
  infinite-older hooks (`useChatMessages`, `canAccessThread`). The UI is
  **text-only**: there is no attachment control, attachment bubble, upload
  adapter, media-injection context, or URL-resolver context. A conversation's
  files live in the consuming app's Conversation Files surface (a Files button +
  panel outside the message timeline), published through the canonical media
  pipeline and read from Firestore — never inserted into the chat timeline, the
  DO message table, resume deltas, inbox previews, or reply previews.
- `ChatShell`/`MessageList` height modes: a default fixed-height card with an
  internal scroll region, or a `fillHeight` mode that flexes to fill a
  bounded-height page panel (scrolling inside) instead of a fixed box. The
  consumer gives `ChatShell` a bounded-height parent.
- The generic mention **UI**: autocomplete dropdown, keyboard behavior,
  composer insertion, and message-text rendering
- The name-resolver context (`ChatNameResolverProvider`, …)
- The adapter config types (`ChatCoreConfig`, `ChatMentionConfig`) and the
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
- The in-flight-send navigation guard from `upload-ui`
  (`useOptionalLocalUploadGuard`), so a send that has left the composer but not
  yet committed is not silently killed by a navigation or sign-out. Optional —
  a consumer without the provider degrades to the unguarded behavior.

## Realtime transport

The realtime transport is the client for the chat Worker's Durable Objects
(Contract A connection + Contract C wire protocol). It is GENERIC — it imports
the generic [`@ttt-productions/realtime-core`](./realtime-core.md) primitives
(reconnect/resume controller, versioned-apply) and NEVER imports `ttt-core` or
the chat Worker. The canonical wire contract (`{ v, type, payload }` frame
version, `CLIENT_KINDS` / `SERVER_KINDS`, close codes, `ChannelRefTuple`, grant
scope/audience, and the client-agreed limits) is owned by
[`@ttt-productions/chat-schemas`](./chat-schemas.md); the transport imports it
(re-exporting the frame-kind maps under its historical `CLIENT_FRAME` /
`SERVER_FRAME` names) and adds the client-side row/frame shapes (`WireMessageRow`,
`ServerFrame`, …) it maps into the UI message shape. The chat Worker consumes the
same contract, so the two agree on the wire without importing each other. The app
injects everything app-specific (the grant provider, the endpoint, the channel ref).

**Pieces** (all under `src/realtime/`, re-exported from the package root):

- `createRealtimeChatClient({ endpoint, channelRef, threadId, currentUserId,
  grantProvider, socketFactory?, timers?, reconnect?, diagnostics? })` → a `RealtimeChatClient`
  (one per thread). Put it on `config.realtime.client`. Drives ONE channel socket:
  subprotocol auth, optimistic send keyed by `clientMessageId` reconciled on the
  server `seq`, explicit read acks, ≥2 s-coalesced typing, presence
  subscribe/unsubscribe, a 20 s heartbeat, reconnect→resume (resume cursor →
  authoritative snapshot → live deltas), epoch-aware history pagination (page ≤50),
  4401 auth-expiry re-grant ONCE, 4403 revoke = stop, teardown on `close()`.
- `createInboxClient({ endpoint, currentUserId, grantProvider, ..., diagnostics? })` → an
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

**Initial-load tracking.** `ChannelClientState.hasLoadedInitialData` (boolean)
records whether the FIRST authoritative chat data has been applied, so the UI shows
an honest working state instead of inferring an empty chat from `messages.length`.
Transitions (once true it stays true):

| Event | `hasLoadedInitialData` |
| --- | --- |
| New client / grant retry / socket open before any snapshot | `false` |
| Non-resync resume snapshot applied (even an empty delta) | `true` |
| Resync snapshot (re-page requested) | stays `false` until the history page |
| First history page (INCLUDING an empty page) | `true` |
| Later disconnect/reconnect after initial load | stays `true` |

`useRealtimeChatMessages.isInitialLoading` derives from `!hasLoadedInitialData`
(NOT from `idle`/`connecting` status — a socket can be `open` with no snapshot yet,
and a post-load reconnect must not fall back into the opening state). While it is
true, `ChatShell` replaces only the message-list region with an accessible
`Opening chat…` indicator (spinner, `role="status"`, polite live region) and
suppresses the reconnect banner so it cannot compete; the header, actions,
`renderAboveMessages`/`renderBelowMessages`, and footer slots still render. After
initial load, messages stay mounted through reconnects under the existing
reconnect/disconnected banner.

**Terminal grant denial (Firebase-free).** A `grantProvider` distinguishes a
transient mint failure from a terminal access denial by throwing the package-owned
`ChatAccessDeniedError` (or any error carrying `isChatAccessDenied: true`;
`isChatAccessDeniedError(err)` recognizes both, cross-realm safe) — the package
never imports or names Firebase, so the app translates its own backend denial (e.g.
`functions/permission-denied`) into this class at the grant boundary. A transient
throw uses the normal reconnect backoff.

BOTH realtime clients honor the terminal signal in their grant-mint failure path:

- **`ChannelClient`** (per-thread): a terminal `ChatAccessDeniedError` stops
  reconnecting, closes the lifecycle, fails any pending optimistic sends, and
  surfaces the stable `access-denied` code on `ChannelClientState.lastErrorCode`.
  `useRealtimeChatMessages` maps that code to `allowed: false`, so `ChatShell`
  renders its existing no-access surface instead of an eternal loader.
- **`InboxClient`** (per-user dock socket): a terminal `ChatAccessDeniedError`
  likewise stops reconnecting (no forever loop / per-cycle warning for a
  banned/suspended account) and surfaces `access-denied` on
  `InboxClientState.lastErrorCode`. The inbox client tracks no pending optimistic
  sends, so there is nothing to fail; the app subscribes to inbox state directly
  (there is no inbox React hook in this package), so the stable code is the surface.

Both clients also set `lastErrorCode: 'revoked'` on a 4403 REVOKED close.
`ChatAccessDeniedError` + `isChatAccessDeniedError` are exported from the package
root.

**Opt-in client diagnostics (`diagnostics`, default OFF).** `ChannelClient`,
`InboxClient`, `createRealtimeChatClient`, and `createInboxClient` all accept an
additive `diagnostics?: boolean | ChatClientDiagnosticsSink` — ONE implementation
(`src/realtime/diagnostics.ts`) shared by both sockets, never a second logger.
Absent/`false` is the production posture: no output, no behavior change, one nullish
check per decision point (the payload object is never constructed). `true` emits ONE
`console.debug` line per client DECISION — `chat_client_<event> {"compact":"json"}` —
and a function routes those same entries into the app's own logger. It exists because a
frame capture shows what ARRIVED, not what the client APPLIED, DROPPED, or MERGED.

Stable event names (`CHAT_CLIENT_DIAGNOSTIC_EVENTS`, exported from the package root —
they are a log-query contract, added/retired deliberately, never renamed). Channel
socket: socket
lifecycle (`connect_attempt`, `grant_failed`, `socket_open`, `socket_close`,
`reconnect_scheduled` — each with the reconnect cause and attempt number), resume
(`resume_request {afterSeq}`, `resume_result {lastMessageSeq, resync, deltaCount,
cursorBefore, cursorAfter}`, `resync_dropped_tail`), per-frame decisions
(`frame_applied` with `op: insert | replace-by-seq | optimistic-reconcile`,
`frame_dropped` with a reason),
`revision_applied`, history (`history_request`, `history_page` with page size, seq
range, cursor advance), and the send lifecycle (`send_optimistic`, `send_ack`,
`send_rejected`, `send_retry`, `send_failed`, `error_frame`). The connection-time,
resume, presence, and socket-timing families are the baseline-campaign metrics and
stay; the attachment-serving instrument (`attachment_transition`) was RETIRED with
the chat-attachment architecture — chat carries no media to observe.

Inbox socket (`chat_client_inbox_*`): socket lifecycle with the same cause/attempt
correlation (`inbox_connect_attempt`, `inbox_grant_failed`, `inbox_socket_open`,
`inbox_socket_close`, `inbox_reconnect_scheduled`), the cursorless
`inbox_resume_request`, projection application (`inbox_snapshot_applied` with
received/active/archived/unread SIZES + `registryDelta`), `inbox_unread_updated`
(dock-dot before/after plus per-row unread count and delta — emitted ONLY on a real
change, so a repeated identical snapshot is silent), `inbox_frame_dropped`, and
`inbox_mark_read`. Inbox payloads carry **no `channelRef`** — a ref names one specific
conversation, so registry/unread evidence is counts and deltas only.

Two invariants the tests pin: (1) **no user content** — ids, seqs, states, counts, and
codes only; never message text, captions, filenames, URLs, grant tokens, or channel
refs; (2)
**bounded** — one line per decision, nothing per render or per heartbeat, and an
uninteresting resume-delta row is summarized by `resume_result` instead of emitting a
line each (a delta row still logs when it carries a moderation kind or reconciles an
optimistic send). A sink that throws is swallowed — diagnostics
observe, they never alter transport behavior or timing.

**Testing.** `socketFactory` + `timers` are injected, so the whole transport is
unit-tested against a MOCK socket and a fake clock with no real network/timers
(`__tests__/realtime/`). Coverage: connect+auth handshake, optimistic send + seq
reconcile, read-ack, typing coalescing, presence, heartbeat, history pagination,
reconnect+resume (snapshot then delta), 4401 re-grant (once), 4403 stop, grant-mint
failure backoff, inbox unread projection, auth-switch teardown, and the diagnostics
flag (identical state + identical sent frames with it off vs. on, zero console output
when off, and the event payloads when on).

**Wire details ASSUMED / not yet confirmable against the Worker** (review these):
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
tier (`ui-core`, `upload-ui`, `mobile-core`). The `file-input`, `media-viewer`,
and `media-schemas` edges were dropped with the attachment UI — a text-only chat
mounts no picker, no media renderer, and no upload spec.
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
