# @ttt-productions/edge-protocol-core

Runtime-neutral primitives for **signed internal backend ↔ Worker / Durable-Object
calls**. WebCrypto + zod only, so the same code runs in Cloud Functions (Node 24)
and Cloudflare Workers/DOs. Tier 0 (zero internal deps).

## Owns

- **Internal request auth** — `signInternalRequest` / `verifyInternalRequest`:
  HMAC-SHA256 over protocol marker + audience + method + exact path + timestamp +
  body hash + deterministic `operationId`, with a narrow replay window. Fails closed.
- **Pre-body header check** — `precheckInternalHeaders(headers, names, { nowSec, replayWindowSec })`:
  the rejects that need no body and no secret (RULE-STD-ARCH-005's "cheap pre-body rejects"). It
  reads `names.version` and `names.timestamp` (decimal seconds, digits only) and answers
  `{ ok: true, version, timestampSec }` or `{ ok: false, reason: 'bad-version' | 'bad-timestamp' |
  'expired' | 'future' }` (`InternalPrecheckResult`). It applies the same version + window rule
  `verifyInternalRequest` applies — one rule, not a copy — so an endpoint runs it before
  `readBoundedBody`, answers a refusal at once, and hands the returned `version` and `timestampSec`
  to `verifyInternalRequest` after the bounded read. `headers` is structural, so a Workers or Node
  `Headers` passes as is; `names` is any `defineInternalAuthHeaders` result.
- **Internal-auth header names** — `defineInternalAuthHeaders({ signature, timestamp, version,
  operationId? })` returns the consumer's names for one transport profile, frozen, with the
  literal types of what it was given (`InternalAuthHeaders<T>`). Every name must be a lowercase
  `[a-z0-9-]` header name and the names must be distinct, or it throws a `TypeError`. The package
  holds no header name of its own: the consumer defines each profile once, in the one place every
  tree that signs or verifies it imports (RULE-STD-ARCH-005).
- **Canonical payload hashing** — `canonicalize` (sorted-key deterministic JSON),
  `sha256Hex`, `hashPayload`: the `payloadHash` used by the versioned-apply rule
  and the activation contract (hash computed EXCLUDING the hash field itself).
- **Canonical string-set hashing** — `hashStringSet(values)`: SHA-256 hex of the
  values sorted by UTF-16 code unit and joined with `\n`, so two runtimes holding
  the same values in any order agree on the digest. A value containing `\n` is
  refused (`RangeError`) — the separator must stay unambiguous.
- **Versioned-apply rule** — `decideVersionedApply`: the frozen
  apply / idempotent / conflict / stale decision.
- **Envelopes** — `StructuredErrorSchema` (edge responses + durable-job `lastError`),
  `EDGE_PROTOCOL_VERSION` + `isProtocolSupported` (one rolling version of
  backward/forward compatibility for rolling Worker/DO deploys).
- **Signed opaque tokens** — `signToken` / `verifyToken`: the `v1.{payload}.{sig}`
  signed-token format used for short-lived, verifiable capability tokens.
- **Edge→origin provenance header names** — `defineProvenanceHeaders({ originMarker: { name,
  value }, edgeMarker: { name, value }, edgeSecret, canonicalHost, clientIp, verifiedClientIp })`
  returns those names and marker values, frozen, plus `internalHeaders`: the derived set of
  `edgeSecret`, `canonicalHost`, `clientIp`, `verifiedClientIp`, and `originMarker.name` (every name
  but `edgeMarker.name`). Names follow the same lowercase, distinct check as the internal-auth names;
  a marker value must be non-empty visible ASCII. Names and values only — the consumer defines them
  once for every tree that shares them (RULE-STD-ARCH-005), and each tree keeps its own logic.

- **Bounded body read** — `readBoundedBody(source, { maxBytes })`: the one pre-authentication
  body read for an endpoint whose signature covers the body (RULE-STD-ARCH-005). A declared
  `Content-Length` over `maxBytes` is refused without reading; otherwise the stream is read with a
  running byte count and cancelled the moment it passes `maxBytes`, so an absent or understated
  `Content-Length` buys nothing. It answers `{ ok: true, text }` — the UTF-8 text `request.text()`
  gives, i.e. what the signed body hash covers — or `{ ok: false, reason: 'too-large', maxBytes }`,
  which the endpoint answers (e.g. 413) before hashing, verifying, or parsing anything. The source
  is structural (headers + a readable byte-stream body), so a Workers or Node `Request` passes as is.
  Each endpoint's budget is declared by the package that owns that endpoint's contract, never here.

## Boundary

Deliberately **domain-neutral**: it never names a consumer's domain, never imports a
domain-shaped package, and holds no state. Each consumer supplies its own secrets,
audiences, paths, and header names. Concrete domain schemas and collection names live
in the consuming app's data package, never here.

The package holds no consumer's header names or marker values; the protocol constants it does hold
(the signing and token versions, the envelope layout) are the scheme itself.

## Entry points

- `.` — all primitives.
