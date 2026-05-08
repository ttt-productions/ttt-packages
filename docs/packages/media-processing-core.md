# @ttt-productions/media-processing-core

Server-side media processing pipeline. Handles image resizing/format conversion, video/audio probing and transcoding, content moderation, and temp workspace management. Runs in Cloud Functions — NOT for client-side use.

## Version
0.0.3

## Dependencies
Runtime: @ttt-productions/firebase-helpers, @ttt-productions/media-contracts, sharp.
Peer (optional): firebase-admin >=10 — only required if importing from `./server`.
Host requirement: ffmpeg/ffprobe must be available on the Cloud Functions runtime for video/audio.

## What It Contains

### Pipeline Entry Point (`run-pipeline.ts`)
- `runMediaPipeline(args)` — Main entry point. Takes a `MediaProcessingSpec` (from media-contracts), downloads the source file via `MediaIO`, processes it through the appropriate processor, runs moderation (if adapter provided), and returns a `MediaProcessingResult`. Supports cancellation via AbortSignal and progress callbacks.

### Image Processing (`image/`)
- `ImageProcessor` — Resize, format conversion (JPEG, PNG, WebP, AVIF), quality adjustment, variant generation (thumbnail, medium, large)
- `resize.ts` — Sharp-based image resizing with aspect ratio preservation
- `formats.ts` — Output format configuration and quality presets
- `ImageVariantSpec` support for generating multiple sizes from a single source

### Video Processing (`video/`)
- `VideoProcessor` — Video transcoding, thumbnail extraction, format conversion
- `ffmpeg.ts` — FFmpeg command builder and executor
- `probe.ts` — FFprobe-based video metadata extraction (duration, dimensions, codec, bitrate)

### Audio Processing (`audio/`)
- `AudioProcessor` — Audio transcoding and normalization
- `probe.ts` — Audio metadata extraction (duration, sample rate, channels, codec)

### Process Media (`process-media.ts` + `processing/`)
- `processMedia(spec, inputPath, outputDir)` — Routes to the correct processor based on media kind
- `processing/errors.ts` — Typed processing error codes
- `processing/result.ts` — Result builders

### I/O Layer (`io/`)
- `MediaIO` interface — Abstraction for downloading source files and uploading processed results
- `fs.ts` — Local filesystem I/O helpers (used by tests and local-only flows)

### Server Wiring (`server/`) — opt-in Firebase adapter
Imported via `@ttt-productions/media-processing-core/server`. Cloud Functions consumers use this; main entry `.` stays Firebase-free.
- `createFirebaseMediaIO({ inputStoragePath, outputStorageBasePath })` — Concrete `MediaIO` implementation backed by Firebase Storage (firebase-admin). Downloads from `inputStoragePath`, uploads outputs under `outputStorageBasePath`, generates download tokens, returns public URLs.
- **Emulator awareness:** when `FIREBASE_STORAGE_EMULATOR_HOST` is set (the Firebase Admin SDK auto-sets it when the Storage emulator is running), constructed URLs target `http://{emulator-host}/...` instead of `https://firebasestorage.googleapis.com/...`. Without this, browsers running against the emulator would fetch production URLs and 404.

### Moderation (`moderation/`)
- `ModerationAdapter` interface — Pluggable content moderation (implemented by consuming apps with Google Cloud Vision / Perspective API)
- `merge.ts` — Merge moderation results from multiple providers

### Workspace (`workspace/temp.ts`)
- `createTempWorkspace()` — Creates and manages a temporary directory for processing. Auto-cleanup on completion.

### Validation (`validation/`)
- `validate-duration.ts` — Duration constraint checking
- `validate-mime.ts` — MIME type validation
- `validate-size.ts` — File size validation

### Utilities (`utils/`)
- `log.ts` — Processing-specific logging
- `paths.ts` — Output path generation
- `safe-path.ts` — Path sanitization

## Pipeline Flow
1. Validate the `MediaProcessingSpec` (via media-contracts schema)
2. Create a temp workspace
3. Download source file via `MediaIO.download()`
4. Route to correct processor (image/video/audio)
5. Process: resize, transcode, generate variants
6. Run moderation (if adapter provided)
7. Upload results via `MediaIO.upload()`
8. Clean up temp workspace
9. Return `MediaProcessingResult` with output URLs, metadata, and moderation results

## Key Design Decisions
- The main entry (`.`) has no direct Firebase Storage or Cloud Vision dependency. `MediaIO` and `ModerationAdapter` are interfaces; consumers wire concrete implementations.
- A Firebase Storage adapter is provided as an opt-in subpath (`./server`) — consumers that don't import from `/server` don't pull `firebase-admin`. This keeps the main entry server-agnostic while still letting Cloud Functions consumers use the canonical adapter (with emulator-aware URL construction) without re-implementing it per app.
- Processing happens in a temp directory that is cleaned up even on failure.
- Image processing uses `sharp` (fast, native), video/audio use `ffmpeg`/`ffprobe` (must be available on the Cloud Functions runtime).
- `MediaProcessingSpec` from media-contracts is validated at runtime before processing begins — fast-fail with actionable error codes.
- AbortSignal support allows cancellation of long-running video transcodes.

## Files
```
src/
  index.ts, types.ts
  run-pipeline.ts               — Main pipeline entry
  process-media.ts              — Media kind router
  image/
    index.ts, image-processor.ts, resize.ts, formats.ts
  video/
    index.ts, video-processor.ts, ffmpeg.ts, probe.ts
  audio/
    index.ts, audio-processor.ts, probe.ts
  processing/
    process-media.ts, errors.ts, result.ts
  io/
    types.ts, fs.ts
  moderation/
    types.ts, merge.ts
  server/
    index.ts, firebase-media-io.ts
  workspace/temp.ts
  validation/
    validate-duration.ts, validate-mime.ts, validate-size.ts
  utils/
    log.ts, paths.ts, safe-path.ts
```
