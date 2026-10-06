# @ttt-productions/chat-react

Chat **React UI** package — the React half of the chat split.

## Owns

- Chat shell, composer, message list, and the realtime-newest-window +
  infinite-older hooks (`useChatMessages`). The UI is
  **text-only**: there is no attachment control, attachment bubble, upload
  adapter, media-injection context, or URL-resolver context. A conversation's
  files live in the consuming app's Conversation Files surface (a Files button +
  panel outside the message timeline), published through the canonical media
  pipeline and read from Firestore — never inserted into the chat timeline, the
  DO message table, resume deltas, or inbox previews.
- `ChatShell`/`MessageList` height modes: a default fixed-height card with an
  internal scroll region, or a `fillHeight` mode that flexes to fill a
  bounded-height page panel (scrolling inside) instead of a fixed box. The
  consumer gives `ChatShell` a bounded-height parent.
- The scrollable message region's surface is the consumer's: `scrollContainer`
  (on `ChatShell` and `MessageList`) is a component rendered in place of the
  default div. It receives `ChatScrollContainerProps` — the ref, class, scroll
  handler, and children — and must render one element carrying all four, so the
  list keeps driving its scroll position. The package knows nothing of the
  surface it is given.
- Message-text rendering (`MessageText`) — the ONE place every chat text surface
  (message bubbles) renders through. It renders the text
  **verbatim**: there is no mention/token grammar, no autocomplete dropdown, no
  composer token insertion, and no chip renderer. Mentions are a Square-posts
  concept owned by the consuming app, never a chat concept.
- **Access is the app's one fact.** `ChatCoreConfig.allowed` (required) is whether the
  current user may read the conversation, decided by the consuming app's own rule for
  the conversation's kind — the package never decides access, holds no member list, and
  has no access mode. False renders the no-access state and reads nothing. On the
  realtime transport a terminal denial from the grant closes the conversation too.
- **One failure seat.** `ChatShellProps.renderLoadError` (required) renders every read
  the chat could not complete, as a `ChatLoadFailure` (`{ scope, error, retry }`):
  `initial` — nothing loaded (the realtime client's first open failed for its budget,
  or the Firestore listener failed before any message) — takes the message list's place;
  `live` — the Firestore listener failed after messages loaded — is a band above the
  kept messages; `older` — an older page failed — is the row at the top of the list
  (`MessageList.olderLoadErrorRow`), and while it shows the list stops requesting older
  pages. `error` is the read's own error (null on the realtime transport), `retry`
  re-runs what failed, and `retrying` is true while a retry runs with the failure still
  shown (an older page being read again), so the app's Retry shows its pending state; a
  retried initial or live failure gives way to the opening state instead. The copy is the app's (the package renders only its slot); the
  Firestore errors come from query-core's `useFirestoreLiveInfinite` (its listener
  error, `olderError`, and `retry`), which `useChatMessages` passes through with
  `sourceState`.
- **The one text declaration.** The `Composer`'s textarea takes `chat-schemas`'
  `CHAT_MESSAGE_TEXT_INPUT` (so it is capped at `CHAT_MESSAGE_TEXT_MAX_LENGTH` and announced as
  required) and shows a `{length}/{max}` counter once text is typed (wired by
  `aria-describedby`). It judges the text with `judgeChatMessageText`, the Worker's own
  judgement: Send stays disabled for a blank text, and what `onSend` receives is the trimmed
  text. A send the Worker still refuses — `too-long` or `blank` — comes back as a correlated
  terminal rejection that fails exactly that bubble.
- **Sender names.** `ChatNameResolverProvider` takes the app's `resolveName`
  (`chat-core`'s `ChatNameResolver`, answering a `ChatNameResolution`) and an optional
  `renderUnresolvedName(resolution)` for `pending` / `unavailable` / `failed` (the
  last with `retry`). `<SenderName senderId>` (used by `MessageItemDefault`) renders the
  resolved name or the app's slot — never a stand-in name; `useSenderNameResolution`
  answers the resolution itself. `MessageItemDefault.onSenderClick` hands the app the
  sender id, and only a resolved name is a click target — the app's unresolved state (a
  Retry included) is never nested inside it. Both message hooks prewarm the senders and
  every server-written line's `referencedUids` (`ChatMessageV1.referencedUids`, mapped from
  the row), so the app resolves the accounts a system line names.
- The adapter config types (`ChatCoreConfig`) and the React render types
  (`MessageRenderer`, `MessageRendererRegistry`)
- A discriminated **transport config** (chat-edge-rebuild P1): `ChatCoreConfig`
  carries an optional `transport: ChatTransportMode` (`'firestore' | 'realtime'`,
  default `'firestore'` so existing call sites are unchanged) plus an optional
  `realtime: ChatRealtimeTransportConfig` (the DO-socket handle and the conversation's
  neutral `ChatConversationRef`). On the `realtime` transport the DO grant is the
  data-access authority.
- The **realtime (Cloudflare Durable Object) transport CLIENT** (`src/realtime/`)
  — the client half of the `ttt-master-app/chat-worker` wire protocol. See the
  "Realtime transport" section below. The FIRESTORE transport stays the unchanged
  default (admin-support threads stay firestore permanently).
- Moderation actions (`MessageActions` / `ThreadActions`): a promise-returning
  handler runs as a pending action — the button spins and ignores repeats until
  it settles; a rejection is re-raised on the global error channel, never
  swallowed. Every chat loader renders ui-core's `Spinner`.
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
version, `CLIENT_KINDS` / `SERVER_KINDS`, close codes, the neutral conversation
reference `ChatConversationRef`, grant scope/audience, the send and mark-read
contracts, and the client-agreed limits) is owned by
[`@ttt-productions/chat-schemas`](./chat-schemas.md); the transport imports it
(re-exporting the frame-kind maps under its historical `CLIENT_FRAME` /
`SERVER_FRAME` names) and adds the client-side row/frame shapes (`WireMessageRow`,
`ServerFrame`, …) it maps into the UI message shape. The chat Worker consumes the
same contract, so the two agree on the wire without importing each other. The app
injects everything app-specific (the grant provider, the endpoint, and the
conversation as a `ChatConversationRef` — the client never interprets its kind or id;
`chat-schemas` is where the type is imported from).

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
  `InboxClientState.hasLoadedInitialData` is true from the first snapshot, so an empty
  registry before it means "not loaded", never "nothing here". `markRead(channelRef)`
  sends `mark-read` with a fresh `requestId` and returns a promise of a
  `ChatMarkReadOutcome`: `{ ok: true }` on the runtime's correlated
  `mark-read-result`, `{ ok: false, code }` with the runtime's reason, `not-sent` (no open
  socket), or `connection-lost` (the socket closed first — the outcome is unknown and the
  dot stays). It settles on the command's own answer, never a timer, and there is no
  optimistic clear: the runtime's fresh snapshot removes the dot.
- `useRealtimeChatMessages(client)` → the same result shape as `useChatMessages`
  (the firestore hook) plus realtime extras (`status`, `typing`, `presence`,
  `send`, `readAck`, `signalTyping`, `initialLoadFailed`, `retry`). Connects on mount; tears every socket down
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

**A first open that keeps failing.** Both clients carry `initialLoadFailed`. It turns
true when there is still no initial data `CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS` (15 s, client
policy) after the first attempt started — whether the attempts failed or one is hanging (a
grant mint stuck until its timeout, a socket that opened but never sent a snapshot) — or at
once when reconnecting stops before any data (the controller gave up, or a 4403 revoke). The
client keeps reconnecting in the background. `ChatShell` then shows the app's `initial`
failure instead of "Opening chat…". `retryNow()` (`RealtimeChatClient.retry()`) cancels a
pending backoff and opens a socket at once (a stopped lifecycle starts again; an attempt
already in flight is left to finish) and clears the flag either way, so the opening state
shows while it tries; the budget already spent stays spent, so a retry that fails is
reported again at once, and one that hangs a full budget later. The first authoritative data clears it for
good; it is never set once data has loaded. An older-history request that cannot be sent,
or whose socket drops, is not left in flight.

**Lifecycle fence (both clients).** Every `connect()` and `close()` advances the
client's lifecycle number. A grant that resolves for an older lifecycle opens nothing,
and every socket callback is fenced to its own socket: a replaced or torn-down socket's
late open, frames, and close never touch the current state (FRONTEND-108). `close()`
detaches the socket before closing it, and settles every pending mark-read as
`connection-lost`.

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

**Connection lifecycle: `connect()` after `close()` (both clients).** `connect()`
starts a lifecycle ONLY from `idle` or a fully torn-down `closed` — a second
`connect()` while one is connecting/open/reconnecting is a no-op, so a
double-mounted owner can never open a second socket (the reconnect path uses the
internal open/schedule helpers, never `connect()`, so a real reconnect is never
blocked). From a `closed` state `connect()` REVIVES the lifecycle: the
realtime-core reconnect controller is `reset()` before it is started, because
`controller.close()` is permanent — while it sits in state `closed`, `start()`
and `onOpen()` no-op and every later `onClose()` returns null, so a revived
client without the reset would work until its first transient close and then park
terminally in `closed` with reconnect disabled and no surfaced error code. The
same `connect()` clears a stale TERMINAL `lastErrorCode` (`revoked` /
`access-denied`): a terminal verdict is terminal WITHIN its lifecycle, while a
later explicit `connect()` is a fresh attempt the authority may legitimately
re-deny. Loaded messages, `hasLoadedInitialData`, and the inbox registry/unread
projection are deliberately KEPT across a restart — a lifecycle restart must not
churn the UI back to an empty opening state.

**Channel liveness — the dead-socket watchdog (CHANNEL ONLY).** The channel DO
answers every 20 s client `heartbeat` through the hibernation auto-response API,
so a healthy channel socket is never inbound-silent for a full heartbeat window.
`ChannelClient` therefore tracks `lastInboundAt` — set when the socket opens,
refreshed by every successfully PARSED inbound frame (the `heartbeat-ack`
included, and a forward-compat type this build does not handle, since a newer
DO's traffic is still liveness proof; an UNPARSEABLE frame refreshes nothing) —
and on the existing heartbeat tick closes a socket that has been silent past a
private client-policy threshold (50 s; not a wire constant, so it is neither in
`chat-schemas` nor exported). The close is LOCAL and deliberately not marked
closed-by-us, so the ordinary `onClose` transient path owns reconnect, backoff,
and resume; the watchdog owns detection only. Because the check rides the 20 s
cadence, detection lands on the next tick past the deadline rather than at
exactly 50 s. Watchdog state is cleared on socket replacement, on close, and on
teardown — the heartbeat timer IS its timer, so a torn-down client has neither.
This exists for the half-open socket whose `onclose` never fires, which would
otherwise strand the UI on a socket that will never deliver another frame.
`InboxClient` deliberately has NO watchdog: the inbox DO has no heartbeat
auto-response and a healthy idle inbox is legitimately silent indefinitely, so the
same rule there would endlessly reconnect healthy sockets.

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
`reconnect_scheduled` — each with the reconnect cause and attempt number,
plus `socket_liveness_timeout`, ONE line per watchdog detection carrying the
silence and threshold in ms), resume
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
failure backoff, connect-after-close revival (both clients — including that a
transient close after a revived lifecycle still reconnects, that a fresh
`connect()` clears a terminal code, and that inbox double-`connect()` opens no
second socket), the channel dead-socket watchdog (heartbeat-acks keep a socket
alive indefinitely; total silence closes it once and reconnects; any valid frame
refreshes the deadline; teardown disarms it), inbox unread projection,
auth-switch teardown, and the diagnostics flag (identical state + identical sent
frames with it off vs. on, zero console output when off, and the event payloads
when on). Any test holding a channel socket open across a long window must model
the DO's heartbeat auto-response (`tickAlive`) — a bare clock advance is inbound
silence, which the watchdog correctly treats as a dead socket.

**Wire details, each confirmed against the Worker:**
- Outbound payloads are typed by the contract: `ChannelClient` sends each `send`,
  `read-ack`, `history`, and `resume` payload as chat-schemas' `ChatSendPayload` /
  `ChatReadAckPayload` / `ChatHistoryPayload` / `ChatResumePayload` — the shapes the
  Worker parses those frames with — so a sender that drifts from the contract fails to
  compile; frames with no payload schema (typing, presence, heartbeat) send `{}`.
  `__tests__/realtime/frame-payloads.test.ts` parses every such frame the client puts on
  the socket with its schema.
- Per-row inbox unread dots: the inbox DO snapshot carries a per-entry `unread`
  boolean on every active registry entry alongside the global `hasUnread` roll-up
  that drives the dock badge (`inbox-do.ts` `snapshot()` → `listRegistryWithUnread()`).
  `channelHasUnread(ref)` reads that per-entry flag; archived rows always report
  `unread: false` (archive = done) on BOTH sides. Booleans only — never counts.
- The channel `resume` frame sends `{ afterSeq }` (the client's resume cursor). The
  DO's `resume` handler honors it via `resumeSince()` and returns
  `{ lastMessageSeq, readSeq, resync, delta }` — a real delta when the gap is
  within the resume backlog (≤500 messages); a gap beyond that is treated as a
  tail-behind and the client pulls a history page instead (`channel-do.ts`).
- Read-ack focus: the client sends `{ readSeq, focused }`; the DO reads
  `payload.focused` (`channel-do.ts`).

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
not build TTT storage paths — it runs no upload path at all, so there is no chat
upload adapter to pass. It also owns no mention machinery: mentions belong to the
app's Square-posts surface, not to chat.

It owns no **reply-to** machinery either. There is no reply-quote renderer, no
reply stylesheet, and no reply argument anywhere on the send path:
`ChatShellProps.onSend`, `ComposerProps.onSend`, and the realtime
`send`/`ChannelClient.send` all take text alone, and no `send` frame carries a
reply pointer. The product has no affordance for replying to a specific message
(`MessageActions` renders only Report/Delete), so the machinery was removed
rather than left dormant. The realtime mapper ignores a
legacy `replyTo` column a pre-removal Channel DO may still broadcast — guarded by
`__tests__/realtime/wire-contract.test.ts`.

## Entry points

- `.` — React chat UI, hooks, adapter config types, and render types
- `./styles` — chat CSS
