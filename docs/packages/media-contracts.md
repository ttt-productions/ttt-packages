# @ttt-productions/media-contracts

Shared type definitions and Zod validation schemas for the media processing pipeline. This is the contract layer between client-side media inputs, upload registration, backend media processors, pending media status documents, and domain-event cache invalidation. No runtime dependencies beyond Zod.

## Version
0.2.29

## Dependencies
Runtime: zod.

## What It Contains

### Zod Schemas (`schemas.ts`)
Runtime-validated schemas for every media-related data structure:
- Basic enums: `SimplifiedMediaType`, `FileCategory`, `MediaKind`, `MediaProcessingStatus`, `MediaJobStatus`, `MediaErrorCode`, `VideoOrientation`
- Small structs: `MediaOwnerRef`, `MediaThreadRef`, `MediaAccept`, `MediaClientConstraints`, `MediaCropSpec`, `ImageVariantSpec`
- Moderation: `MediaModerationStatus`, `MediaModerationFinding`, `MediaModerationResult`, `MediaModerationSpec`
- Processing: `MediaProcessingSpec`, `MediaProcessingError`, `MediaOutput`, `MediaProcessingResult`
- Documents: `MediaJobStatusPayload`, strict discriminated `PendingMedia` states, terminal-only `ArchivedPendingMedia` states, `StartUploadRequest`, `StartUploadResponse`
- Target info: strict per-origin targetInfo schemas plus `parseTargetInfo(fileOrigin, raw)`
- Timestamp: `TimestampLike` (handles Firestore Timestamp, epoch ms, Date)

### Domain Events (`domain-events.ts`)
Package-defined upload/processor event variants emitted by Cloud Functions and consumed by `ttt-prod/src/lib/domain-events.ts`:
- `DomainEventSchema` — strict discriminated union of 12 package variants
- `DomainEvent` — inferred event type
- `DomainEventIdsFor<T>` — helper for extracting the `ids` shape for a specific event type

Current package variants:
- `profile.pictureUpdated`
- `skill.created`
- `streetz.postCreated`
- `opportunity.promptCreated`
- `opportunity.replyCreated`
- `job.created`
- `job.applicationSubmitted`
- `project.updated`
- `libraryAsset.coverUpdated`
- `libraryAsset.subItemUpdated`
- `moderation.violationCreated`
- `chat.attachmentFinalized`

### Unified Upload Contract
- `PendingMediaSchema` — strict discriminated union for `pending`, `processing`, `completed`, `failed`, and `rejected` `pendingMedia/{id}` documents. Terminal branches require `terminalAt`.
- `ArchivedPendingMediaSchema` / `parseArchivedPendingMedia` — strict terminal-only archive contract for `pendingMediaArchive/{id}` documents, requiring `terminalAt` and `archivedAt`.
- `PendingMediaResultSchema` — terminal success/rejection result shape with `events: DomainEvent[]` and optional audit-only `affected` entries.
- `StartUploadRequest` / `StartUploadResponse` — shared callable contract for the unified upload pipeline.
- `ClientContextSchema` — required upload context containing `surface` and optional `targetIds`.

Processor results no longer carry TanStack Query keys. `result.events` is the cache contract; `result.affected` is audit/admin metadata only.

### TypeScript Types (`types.ts`)
All types are `z.infer<>` derivations from the schemas — ensuring runtime validation and static types are always in sync.

Important unified-upload exports include:
- `PendingMedia`, `PendingMediaPending`, `PendingMediaProcessing`, `PendingMediaCompleted`, `PendingMediaFailed`, `PendingMediaRejected`
- `ArchivedPendingMedia`
- `PendingMediaResult`, `PendingMediaErrorCategory`
- `StartUploadRequest`, `StartUploadResponse`
- per-origin targetInfo types, including `ProjectFileTargetInfo`
- `TargetInfoFor<O extends FileOrigin>` mapped type

### Helpers (`helpers.ts`)
Utility functions for working with media types:
- `parseMediaProcessingSpec(input)` — Validates a processing spec at runtime (fast-fail with actionable errors)
- Media type detection, file category classification, constraint validation

### File Origin (`file-origin.ts`)
`FileOrigin` is the kebab-case union of all 17 upload origins in the TTT Productions ecosystem. It is the single source of truth for `pendingMedia.fileOrigin`, matched letter-for-letter against Storage paths and processor dispatch.

Values:
- `profile-picture`
- `skill-media`
- `streetz`
- `job-posting`
- `job-reply`
- `opportunity-prompt`
- `opportunity-reply`
- `library-cover-square`
- `library-cover-poster`
- `library-cover-cinematic`
- `chapter-photo`
- `song-photo`
- `song-audio`
- `show-photo`
- `show-video`
- `chat-attachment`
- `project-file`

### TTT Media Specs (`ttt-media-specs.ts`)
`TTT_MEDIA_SPECS` — Per-`FileOrigin` registry of `TTTMediaOriginEntry` objects covering all 17 upload origins. Each entry defines:
- `kind` — `image | video | audio | generic`
- `accept` — Allowed MIME kinds and optional explicit MIME strings
- `maxBytes` — Upload size cap, inlined as byte literals (e.g. `5 * 1024 * 1024`)
- `imageCrop` — Aspect ratio, output dimensions, format, and quality for the client-side crop step
- `video` / `audio` — Backend processing parameters where relevant
- `client` — UI behavior block (`allowPick`, `allowCapturePhoto`, `allowRecordVideo`, `allowRecordAudio`, `cameraFacingMode`, `maxRecordDurationSec`)
- `processing` — optional per-kind processing specs used by backend processors

The registry is typed as `Record<FileOrigin, TTTMediaOriginEntry>` — adding a new `FileOrigin` member without a matching spec entry fails at compile time.

This is named `TTT_MEDIA_SPECS` because it is TTT-Productions–specific. Q-Sports can add a parallel specs constant if it adopts this package for its own media pipeline.

## Key Design Decisions
- Schemas are the single source of truth — types are always derived via `z.infer<>`, never manually duplicated.
- This package has no React or Firebase dependencies — it is pure data contracts usable anywhere (frontend, backend, tooling).
- `PendingMediaSchema` defines the strict Firestore document shape for media items awaiting processing.
- Completed/rejected pending media docs carry `result.events`; frontend cache invalidation happens in the consuming app from those domain events.
- `MediaProcessingResult` describes the low-level media transform/moderation result. `PendingMediaResult` describes the terminal pending-media document result.
- `FileOrigin` lives here because it is a media-pipeline contract shared by client, functions, and processors.
- `TTT_MEDIA_SPECS` is the single source of truth for upload caps and processing specs across both the `ttt-prod` client and backend processors.

## Files
```
src/
  index.ts
  schemas.ts          — Zod schemas, pending-media/archive contracts, startUpload contract, targetInfo schemas
  types.ts            — z.infer<> type exports and TargetInfoFor mapped type
  helpers.ts          — Parsing and utility functions
  short-types.ts      — Short-form shared media type aliases
  file-origin.ts      — FileOrigin schema/type with 17 upload origins
  ttt-media-specs.ts  — TTT_MEDIA_SPECS registry (17 entries, one per FileOrigin)
  domain-events.ts    — Package-defined DomainEvent schema/type helpers
```
