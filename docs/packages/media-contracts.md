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

## Key Design Decisions
- Schemas are the single source of truth — types are always derived via `z.infer<>`, never manually duplicated.
- This package has no React or Firebase dependencies — it's pure data contracts usable anywhere (frontend, backend, tooling).
- `PendingMediaDoc` schema defines the Firestore document shape for media items awaiting processing.
- `MediaProcessingSpec` is the input contract for `media-processing-core`'s `runMediaPipeline()`.

## Files
```
src/
  index.ts
  schemas.ts    — All Zod schemas
  types.ts      — z.infer<> type exports
  helpers.ts    — Parsing and utility functions
```
