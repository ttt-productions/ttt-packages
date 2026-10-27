# @ttt-productions/media-schemas

Generic media schema and helper package. This replaces the old `media-contracts` package name.

## Owns

- Generic media data types such as upload phase/state, media kind/category, processing status, job status, and media error codes
- Generic helpers such as `getSimplifiedMediaType` (`ensureFileWithContentType` lives in `file-input`, not here)
- Neutral media-origin spec shape (`MediaOriginSpec`)
- Generic media constraints and processing spec types
- Publication/serving-readiness state (`MediaPublicationStateSchema`/`MediaPublicationState`: `notStarted`/`activating`/`publishing`/`live`/`publicationFailed`), baked into the pending-media factory's base shape
- Crash-recovery lifecycle fields on the pending-media factory: `processingStartedAt` and `processingLeaseExpiresAt` (epoch ms) and `processingAttemptCount` (integer). A `processing` row requires all three, since every claim writes them together; on every other status they are optional, so a terminal or archived row keeps its history. The state machine that interprets them is below; the policy values (lease length, attempt ceiling) are the app's.
- `createPendingMediaSchemas(...)` factory for composing app-specific pending-media schemas
- The pure pending-media lifecycle decisions and the staged-upload metadata verdict (see below)
- The media pipeline's output-key names (`src/pipeline-output-keys.ts`) — the ONE declaration of
  the keys media-processing-core writes: `TIMED_MEDIA_MAIN_OUTPUT_KEY` (`main`, a video's or audio
  file's transcode), `VIDEO_POSTER_OUTPUT_KEY` (`poster`, a video's poster frame, written whenever the
  transcode produces one), `IMAGE_DEFAULT_OUTPUT_KEY` (`original`, an image whose spec declares no
  variants; otherwise each variant's own `key`), the per-kind set `MEDIA_PIPELINE_OUTPUT_KEYS`
  (`{ video: [main, poster], audio: [main] }`), and the `MediaPipelineOutputKey` type. media-processing-core
  names its outputs from these, and a consumer that must know every object an ingest can leave behind
  (an app's canonical variant-key set, a cleanup sweep) derives it from them rather than restating the
  names

## Boundary

`media-schemas` does not know any app's origins, target-info schemas, domain events, atoms, or media registry values. An app's concrete pending-media schema is composed in its data package from this package's generic factory.

Concrete media values live in the consuming app's data package, not here: its origin enum and media registry, its upload-request/response schemas, its target-info parsing, its domain-event variants, and its own atoms.

## Canonical content classification contracts

Owns the generic cross-boundary shapes for the canonical-upload-content-classification design:
`ClientMediaClaimSchema` (what the user DID — recorder/camera strong, picker advisory, never
byte authority), `MediaInspectionResultSchema` + `MediaSafetyPlanSchema` + the bounded
`NormalizedCodecIdSchema` (what the bytes ARE — produced only by media-processing-core's
inspector; its optional `durationSec` is the measured length in seconds, never the header's), and the generic supported-format registry (`MediaFormatIdSchema` enum in
schemas.ts, catalog + `projectAcceptTokens` in format-registry.ts). `MediaAcceptSchema`
gained the optional `formats` selection and `MediaProcessingResult` optionally carries the
inspection. Policy (which formats an origin enables) lives in the app's registry, never here.

## Pending-media lifecycle decisions (pure)

A pending-media row moves `pending → processing → completed | failed | rejected`, and every decision about it is taken over the CURRENT row read inside a transaction — never a frozen event snapshot. `src/pending-media-lifecycle.ts` owns the two decisions; the Admin-SDK transaction wrappers that apply them are in `media-processing-core/server`.

- **Claim** — `decidePendingMediaClaim(row, now, { leaseMs, maxAttempts })`. Delivery is at-least-once and a hard-killed attempt leaves a row at `processing`, so a claim carries a bounded attempt count and a lease: a fresh `pending` row is claimed; a `processing` row under an active lease is `busy` (a live attempt owns it — never failed, never double-dispatched); an expired lease is reclaimed while attempts remain and `exhausted` after that; a terminal row is `terminal`. The claim `write` is the exact update to apply.
- **Finalize** — `decidePendingMediaFinalize(row | undefined, target)` is the compare-and-set transition table: only a `pending` / `processing` row transitions (`applied`); the same terminal status is an idempotent `noop`; a different one is a `conflict` and is never overwritten. `buildPendingMediaTerminalFields(status, extra, now)` is the one terminal field set (status, its `*At`, `terminalAt`, `updatedAt`), and its declared return is that literal set, per status: with no extra fields (`{}`) and a known status it is exactly `PendingMediaCompletedTerminalFields` / `PendingMediaFailedTerminalFields` / `PendingMediaRejectedTerminalFields`; with extra fields it is that set intersected with them; for a status union it is `PendingMediaTerminalFields<S>`, the union of their sets. The per-status sets are plain object types and the first declared signature returns the `completed` one, so a static reader of the shipped declarations can list the keys a terminal write carries. Extra fields merge after `status` / `terminalAt` / `updatedAt` and before the status's own `*At` stamp.

The app supplies the policy numbers and the clock; nothing here knows an origin or a collection.

## Staged-upload verdict (pure)

`verifyStagedUploadMetadata(metadata, spec, { allowNeutralContentType })` checks what actually landed in staging — the object's stored `contentType` and `size` — against the origin's `MediaOriginSpec`, never the client's claim: the content type must be an accepted kind (or, for a `file` kind, match an accepted MIME entry, `x/*` wildcards included), and the size must be a present, readable byte count within `maxBytes`; an absent or unreadable size fails closed. "Readable" is `parseStorageObjectSize(size)` — the ONE parser of a storage object's reported size (a metadata read or a storage event, number or decimal string): a whole, non-negative, safe-integer byte count, else `undefined` (absent, `NaN`, negative, fractional, beyond `Number.MAX_SAFE_INTEGER`, or not a plain decimal). Anything that reads a storage size uses it rather than parsing its own. `NEUTRAL_CONTENT_TYPE` (`application/octet-stream`, what a client sends when the picker cannot tell — the ONE declaration that file-input's picker, upload-core's transfer gate, and this verdict all read) passes only when the app opts in, which it does only when processing inspects the bytes and rejects what the origin does not accept. The verdict is fail-fast UX at accept time; byte inspection at processing stays the authority. The app maps a failed verdict to its own error and copy.
