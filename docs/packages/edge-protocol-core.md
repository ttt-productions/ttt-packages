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
- **Signed opaque tokens** — `signToken` / `verifyToken`: the `v1.{payload}.{sig}`
  signed-token format used for short-lived, verifiable capability tokens.
- **Edge→origin provenance headers** — `ORIGIN_MARKER_HEADER` / `_VALUE`,
  `EDGE_MARKER_HEADER` / `_VALUE`, `EDGE_SECRET_HEADER`,
  `EDGE_CANONICAL_HOST_HEADER`, `EDGE_CLIENT_IP_HEADER`,
  `VERIFIED_CLIENT_IP_HEADER`, plus `EDGE_INTERNAL_HEADERS` (the
  client-forgeable set every front door deletes inbound) and its
  `EdgeInternalHeader` type. The single definition ARCH-005 requires for a
  cross-tree trust contract: the Worker front door that mints the headers and
  the origin that validates the secret+host pair and mints the verified client
  IP import the SAME strings. Names only — each tree keeps its own trust logic.

## Boundary

Deliberately **domain-neutral**: it never names chat or media, never imports a
chat- or media-shaped package, and holds no state. Each consumer supplies its own
secret + audience (e.g. the media authority's `MEDIA_AUTHORITY_SYNC_SECRET` +
audience `ttt-media-authority:{env}`). The media serving authority and the chat
realtime layer (chat-sync writer, chat-grant minting, chat-worker auth) both
consume it today. Concrete domain schemas and collection names live in
`ttt-core`, never here.

The provenance header names are the one `ttt`-branded surface: they are literal
wire strings two independently deployed runtimes must agree on, which is a
sanctioned exception recorded in `package-architecture.md` § Direction rules.

## Entry points

- `.` — all primitives.
