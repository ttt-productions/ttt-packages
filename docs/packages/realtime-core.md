# @ttt-productions/realtime-core

Runtime-neutral, **GENERIC** realtime primitives (Tier 1 — depends only on
`edge-protocol-core`). Zero TTT specifics: it owns no Firestore collection name,
selector, domain-action catalog, or report/case/audit type. The chat realtime
layer (and any future realtime consumer) supplies its own domain types, secrets,
collections, and storage runtime. WebCrypto + zod only — runs in Node 22,
Cloudflare Workers, and browsers.

## Owns

- **Protocol + stable error codes** — re-exports the shared
  `EDGE_PROTOCOL_VERSION` / `isProtocolSupported` / `StructuredError` from
  `edge-protocol-core` (one source of truth) plus the app-neutral
  `REALTIME_ERROR_CODES` (`unauthorized`, `origin-not-allowed`, `grant-expired`,
  `protocol-unsupported`, `rate-limited`, `not-found-yet`, `conflict`, `internal`).
- **Wire envelopes** — `RealtimeMessageEnvelopeSchema` (client↔DO transport:
  version, seq/ackSeq, clientMessageId, opaque app `payload`) and
  `VersionedSyncItemSchema` (the neutral shape of an authoritative projection /
  command / outbox delivery).
- **Versioned-apply appliers** — `decideApply` / `applyVersioned` wrap
  `edge-protocol-core`'s frozen `decideVersionedApply` (apply / idempotent /
  conflict / stale) so a DO applies an incoming item over its stored record via
  an injected store, without re-implementing the comparison.
- **Reconnect/resume state machine** — `createReconnectController`: a pure
  exponential-with-full-jitter backoff lifecycle (`idle|connecting|open|reconnecting|closed`)
  with an injectable randomness source for deterministic tests.
- **Monotonic allocators** — `allocateNext` / `advanceFloor` / `recoveredFloor`:
  the generic `seqAllocator` / `messageRevAllocator` semantics (same-txn bump,
  restore-advance to a recovered floor, never reuse a value, never rowid).
- **v1 SQLite row SHAPES** — generic TypeScript row types (`SeqAllocatorRow`,
  `MessageRevAllocatorRow`, `UnreadProjectionRow`, `OutboxRow`) that a concrete
  Durable Object maps to actual SQLite DDL.
- **Generic DO persistence interfaces** — `VersionedStore`, `AllocatorStore`,
  `OutboxStore`: the contracts a concrete DO storage layer implements.

## Boundary

The concrete Cloudflare Durable Object runtime (the chat Worker), the actual
SQLite DDL, the domain message kinds, and the signing secrets are app-level
(`ttt-master-app/chat-worker`), built against these interfaces — they are NOT in
this package. The state-machine/allocator/apply logic here is pure and unit-tested.

`@ttt-productions/chat-react` is also a direct, architecturally-sanctioned
consumer — it imports `createReconnectController` for its client-side realtime
transport, not just the server-side DO Worker.

## Entry points

- `.` — the single server-safe root (no React, no Firebase, no Node-only APIs).

## Boundary-guard

This package must never import `ttt-core`, `chat-*`, or `media-*`. Its only
internal dependency is `edge-protocol-core`.
