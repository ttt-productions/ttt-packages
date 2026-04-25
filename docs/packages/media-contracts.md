# @ttt-productions/media-contracts

Shared type definitions and Zod validation schemas for the media processing pipeline. This is the contract layer between client-side media inputs (file-input, upload-core) and server-side processing (media-processing-core). No runtime dependencies beyond Zod.

## Version
0.2.11

## Dependencies
Runtime: zod.

## What It Contains

### Zod Schemas (`schemas.ts`)
Runtime-validated schemas for every media-related data structure:
- Basic enums: `SimplifiedMediaType`, `FileCategory`, `MediaKind`, `MediaProcessingStatus`, `MediaJobStatus`, `MediaErrorCode`, `VideoOrientation`
- Small structs: `MediaOwnerRef`, `MediaThreadRef`, `MediaAccept`, `MediaClientConstraints`, `MediaCropSpec`, `ImageVariantSpec`
- Moderation: `MediaModerationStatus`, `MediaModerationFinding`, `MediaModerationResult`, `MediaModerationSpec`
- Processing: `MediaProcessingSpec`, `MediaProcessingError`, `MediaOutput`, `MediaProcessingResult`
- Documents: `MediaJobStatusPayload`, `PendingMediaDoc`
- Timestamp: `TimestampLike` (handles Firestore Timestamp, epoch ms, Date)

### TypeScript Types (`types.ts`)
All types are `z.infer<>` derivations from the schemas — ensuring runtime validation and static types are always in sync.

### Helpers (`helpers.ts`)
Utility functions for working with media types:
- `parseMediaProcessingSpec(input)` — Validates a processing spec at runtime (fast-fail with actionable errors)
- Media type detection, file category classification, constraint validation

### File Origin & Pending File (`file-origin.ts`)
- `FileOrigin` — Kebab-case union of all 16 upload origins in the TTT Productions ecosystem. Single source of truth for `pendingMedia.fileOrigin`, matched letter-for-letter against Firestore storage paths. Values: `profile-picture`, `skill-media`, `streetz`, `job-posting`, `job-reply`, `opportunity-prompt`, `opportunity-reply`, `library-cover-square`, `library-cover-poster`, `library-cover-cinematic`, `chapter-photo`, `song-photo`, `song-audio`, `show-photo`, `show-video`, `chat-attachment`.
- `PendingFile` — Interface for the `pendingMedia` Firestore document shape: `id`, `userId`, `fileOrigin`, `originalFileName`, `pendingStoragePath`, `status` (`pending | processing | completed | failed | rejected`), `createdAt`, and optional fields (`errorMessage`, `targetInfo`, `targetDocPath`, `targetFields`, `textContent`).

### TTT Media Specs (`ttt-media-specs.ts`)
`TTT_MEDIA_SPECS` — Per-`FileOrigin` registry of `MediaProcessingSpec` objects covering all 16 upload origins. Each entry defines:
- `kind` — `image | video | audio | generic`
- `accept` — Allowed MIME kinds (and optional explicit MIME strings)
- `maxBytes` — Upload size cap, inlined as byte literals (e.g. `5 * 1024 * 1024`)
- `imageCrop` — Aspect ratio, output dimensions, format, and quality for the client-side crop step
- `video` / `audio` — Backend processing parameters (duration cap, encode preset, CRF, scale mode)
- `client` — UI behavior block (allowPick, allowCapturePhoto, allowRecordVideo, allowRecordAudio, cameraFacingMode, maxRecordDurationSec)

The registry is typed as `as const satisfies Record<FileOrigin, MediaProcessingSpec>` — adding a new `FileOrigin` member without a matching spec entry, or supplying a spec that violates the schema, fails at compile time.

This is named `TTT_MEDIA_SPECS` because it is TTT-Productions–specific. Q-Sports will get a parallel `Q_MEDIA_SPECS` constant in this same package when q-sports does its own callable migration.

## Key Design Decisions
- Schemas are the single source of truth — types are always derived via `z.infer<>`, never manually duplicated.
- This package has no React or Firebase dependencies — it's pure data contracts usable anywhere (frontend, backend, tooling).
- `PendingMediaDoc` schema defines the Firestore document shape for media items awaiting processing.
- `MediaProcessingSpec` is the input contract for `media-processing-core`'s `runMediaPipeline()`.
- `FileOrigin` and `PendingFile` live here (moved from ttt-core in Phase 1 Step 14a) because they are media-pipeline concepts, not TTT-core business logic. ttt-core imports `PendingFile` for use in `ContentViolation`.
- `TTT_MEDIA_SPECS` is the **single source of truth** for upload caps and processing specs across both the ttt-prod client (`MediaInput` component reads `maxBytes`, `accept`, `imageCrop`, `client`) and the backend (callables read `maxBytes`; processors will read full processing config in a later migration step).

## Files
```
src/
  index.ts
  schemas.ts          — All Zod schemas
  types.ts            — z.infer<> type exports
  helpers.ts          — Parsing and utility functions
  file-origin.ts      — FileOrigin union + PendingFile interface
  ttt-media-specs.ts  — TTT_MEDIA_SPECS registry (16 entries, one per FileOrigin)
```
