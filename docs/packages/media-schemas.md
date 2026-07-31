# @ttt-productions/media-schemas

Generic media schema and helper package. This replaces the old `media-contracts` package name.

## Owns

- Generic media data types such as upload phase/state, media kind/category, processing status, job status, and media error codes
- Generic helpers such as `getSimplifiedMediaType` (`ensureFileWithContentType` lives in `file-input`, not here)
- Neutral media-origin spec shape (`MediaOriginSpec`)
- Generic media constraints and processing spec types
- Publication/serving-readiness state (`MediaPublicationStateSchema`/`MediaPublicationState`: `notStarted`/`activating`/`publishing`/`live`/`publicationFailed`), baked into the pending-media factory's base shape
- Optional crash-recovery lifecycle fields on the pending-media factory base shape (ride every status + archive branch): `processingAttemptCount` (non-negative integer) and `processingLeaseExpiresAt` (epoch ms). Optional everywhere so legacy/archived docs still parse; the TTT retry policy that interprets them lives in `ttt-core`.
- `createPendingMediaSchemas(...)` factory for composing app-specific pending-media schemas

## Boundary

`media-schemas` does not know TTT origins, TTT target-info schemas, TTT domain events, TTT atoms, or TTT media registry values. The concrete TTT pending-media schema is composed in `ttt-core` from this package's generic factory.

Concrete TTT media values live in `ttt-core`, not here: `FileOrigin`, `TTT_MEDIA_SPECS`, the upload-request/response schemas, `parseTargetInfo` and target-info schemas, `DomainEvent` variants, and TTT atoms such as `Mention` and `MentionType`.

## Canonical content classification contracts (2026-07-31)

Owns the generic cross-boundary shapes for the canonical-upload-content-classification design:
`ClientMediaClaimSchema` (what the user DID — recorder/camera strong, picker advisory, never
byte authority), `MediaInspectionResultSchema` + `MediaSafetyPlanSchema` + the bounded
`NormalizedCodecIdSchema` (what the bytes ARE — produced only by media-processing-core's
inspector), and the generic supported-format registry (`MediaFormatIdSchema` enum in
schemas.ts, catalog + `projectAcceptTokens` in format-registry.ts). `MediaAcceptSchema`
gained the optional `formats` selection and `MediaProcessingResult` optionally carries the
inspection. Policy (which formats an origin enables) lives in ttt-core, never here.
