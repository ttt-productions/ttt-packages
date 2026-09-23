# @ttt-productions/media-schemas

Generic media schema and helper package. This replaces the old `media-contracts` package name.

## Owns

- Generic media data types such as upload phase/state, media kind/category, processing status, job status, and media error codes
- Generic helpers such as `getSimplifiedMediaType` (`ensureFileWithContentType` lives in `file-input`, not here)
- Neutral media-origin spec shape (`MediaOriginSpec`)
- Generic media constraints and processing spec types
- Publication/serving-readiness state (`MediaPublicationStateSchema`/`MediaPublicationState`: `notStarted`/`activating`/`publishing`/`live`/`publicationFailed`), baked into the pending-media factory's base shape
- Optional crash-recovery lifecycle fields on the pending-media factory base shape (ride every status + archive branch): `processingAttemptCount` (non-negative integer) and `processingLeaseExpiresAt` (epoch ms). Optional everywhere so legacy/archived docs still parse. The state machine that interprets them is below; the policy values (lease length, attempt ceiling) are the app's.
- `createPendingMediaSchemas(...)` factory for composing app-specific pending-media schemas
- The pure pending-media lifecycle decisions and the staged-upload metadata verdict (see below)

## Boundary

`media-schemas` does not know TTT origins, TTT target-info schemas, TTT domain events, TTT atoms, or TTT media registry values. The concrete TTT pending-media schema is composed in `ttt-core` from this package's generic factory.

Concrete TTT media values live in `ttt-core`, not here: `FileOrigin`, `TTT_MEDIA_SPECS`, the upload-request/response schemas, `parseTargetInfo` and target-info schemas, `DomainEvent` variants, and TTT atoms such as `Mention` and `MentionType`.

## Canonical content classification contracts

Owns the generic cross-boundary shapes for the canonical-upload-content-classification design:
`ClientMediaClaimSchema` (what the user DID — recorder/camera strong, picker advisory, never
byte authority), `MediaInspectionResultSchema` + `MediaSafetyPlanSchema` + the bounded
`NormalizedCodecIdSchema` (what the bytes ARE — produced only by media-processing-core's
inspector), and the generic supported-format registry (`MediaFormatIdSchema` enum in
schemas.ts, catalog + `projectAcceptTokens` in format-registry.ts). `MediaAcceptSchema`
gained the optional `formats` selection and `MediaProcessingResult` optionally carries the
inspection. Policy (which formats an origin enables) lives in ttt-core, never here.

## Pending-media lifecycle decisions (pure)

A pending-media row moves `pending → processing → completed | failed | rejected`, and every decision about it is taken over the CURRENT row read inside a transaction — never a frozen event snapshot. `src/pending-media-lifecycle.ts` owns the two decisions; the Admin-SDK transaction wrappers that apply them are in `media-processing-core/server`.

- **Claim** — `decidePendingMediaClaim(row, now, { leaseMs, maxAttempts })`. Delivery is at-least-once and a hard-killed attempt leaves a row at `processing`, so a claim carries a bounded attempt count and a lease: a fresh `pending` row is claimed; a `processing` row under an active lease is `busy` (a live attempt owns it — never failed, never double-dispatched); an expired lease is reclaimed while attempts remain and `exhausted` after that; a terminal row is `terminal`. The lease of a row written before leases existed derives from `processingStartedAt`, else `createdAt`. The claim `write` is the exact update to apply.
- **Finalize** — `decidePendingMediaFinalize(row | undefined, target)` is the compare-and-set transition table: only a `pending` / `processing` row transitions (`applied`); the same terminal status is an idempotent `noop`; a different one is a `conflict` and is never overwritten. `buildPendingMediaTerminalFields(status, extra, now)` is the one terminal field set (status, its `*At`, `terminalAt`, `updatedAt`).

The app supplies the policy numbers and the clock; nothing here knows an origin or a collection.

## Staged-upload verdict (pure)

`verifyStagedUploadMetadata(metadata, spec, { allowNeutralContentType })` checks what actually landed in staging — the object's stored `contentType` and `size` — against the origin's `MediaOriginSpec`, never the client's claim: the content type must be an accepted kind (or, for a `file` kind, match an accepted MIME entry, `x/*` wildcards included), and the size must be a present, readable byte count within `maxBytes`; an absent or unreadable size fails closed. `NEUTRAL_CONTENT_TYPE` (`application/octet-stream`, what a client sends when the picker cannot tell — the ONE declaration that file-input's picker, upload-core's transfer gate, and this verdict all read) passes only when the app opts in, which it does only when processing inspects the bytes and rejects what the origin does not accept. The verdict is fail-fast UX at accept time; byte inspection at processing stays the authority. The app maps a failed verdict to its own error and copy.
