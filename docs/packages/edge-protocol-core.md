# @ttt-productions/edge-protocol-core

Runtime-neutral primitives for **signed internal backend ↔ Worker / Durable-Object
calls**. WebCrypto + zod only, so the same code runs in Cloud Functions (Node 22)
and Cloudflare Workers/DOs. Tier 0 (zero internal deps).

## Owns

- **Internal request auth** — `signInternalRequest` / `verifyInternalRequest`:
  HMAC-SHA256 over protocol marker + audience + method + exact path + timestamp +
  body hash + deterministic `operationId`, with a narrow replay window. Fails closed.
- **Canonical payload hashing** — `canonicalize` (sorted-key deterministic JSON),
  `sha256Hex`, `hashPayload`: the `payloadHash` used by the versioned-apply rule
  and the activation contract (hash computed EXCLUDING the hash field itself).
- **Versioned-apply rule** — `decideVersionedApply`: the frozen
  apply / idempotent / conflict / stale decision shared by the media serving
  authority and the chat realtime authorities.
- **Envelopes** — `StructuredErrorSchema` (edge responses + durable-job `lastError`),
  `EDGE_PROTOCOL_VERSION` + `isProtocolSupported` (one rolling version of
  backward/forward compatibility for rolling Worker/DO deploys).

## Boundary

Deliberately **domain-neutral**: it never names chat or media, never imports a
chat- or media-shaped package, and holds no state. Each consumer supplies its own
secret + audience (e.g. the media authority's `MEDIA_AUTHORITY_SYNC_SECRET` +
audience `ttt-media-authority:{env}`). The media serving authority consumes it
now; the chat realtime layer (sync/command/outbox signing + versioned apply)
builds on it later. Concrete domain schemas and collection names live in
`ttt-core`, never here.

## Entry points

- `.` — all primitives.
