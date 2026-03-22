# @ttt-productions/media-processing-core

Server-side media processing pipeline. Handles image resizing/format conversion, video/audio probing and transcoding, content moderation, and temp workspace management. Runs in Cloud Functions — NOT for client-side use.

## Version
0.0.3

## Dependencies
Runtime: @ttt-productions/firebase-helpers, @ttt-productions/media-contracts, sharp.
Peer: none (Node.js-only package, requires ffmpeg/ffprobe on the host).

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
- `MediaIO` interface — Abstraction for downloading source files and uploading processed results (implemented by consuming apps with Firebase Storage)
- `fs.ts` — Local filesystem I/O helpers

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
- `MediaIO` and `ModerationAdapter` are injected — this package has no direct Firebase Storage or Cloud Vision dependency. Consuming apps wire up the concrete implementations.
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
  workspace/temp.ts
  validation/
    validate-duration.ts, validate-mime.ts, validate-size.ts
  utils/
    log.ts, paths.ts, safe-path.ts
  firebase/
    firestore.ts, storage.ts
```
