# @ttt-productions/upload-core

Firebase Storage upload system with resumable uploads, progress tracking, upload queuing with concurrency control, and session persistence. Handles the actual file transfer after file-input prepares the files.

## Version
0.0.3

## Dependencies
Runtime: @ttt-productions/firebase-helpers.
Peer: firebase, react.

## What It Contains

### Error types & content-type guard (Phase 1)
- `UploadError` — Typed error class with `code: 'missing_content_type' | 'invalid_content_type'`. Throw before any bytes hit Firebase Storage when metadata.contentType is empty or not a valid media MIME.
- `isValidMediaContentType(ct)` — Predicate for `image/*`, `video/*`, `audio/*`. Rejects empty strings and `application/octet-stream`.
- `uploadFileResumable` now guards contentType at the top; consumers catch `UploadError` via `instanceof` or `err.code`.

### Storage Operations
- `uploadFileResumable(args)` — Resumable upload to Firebase Storage with retry policy, progress callbacks, and AbortSignal cancellation support
- `deleteFile(args)` — Delete a file from Firebase Storage

### Upload Queue (`queue/upload-queue.ts`)
- `UploadQueue` — Manages concurrent uploads with configurable concurrency limit (default 3), priority ordering, and session state tracking. Each upload gets a `UploadController` with `pause()`, `resume()`, `cancel()`, and `done` promise.

### Upload Store (`utils/upload-store.ts`)
- In-memory state store for tracking all upload sessions. Each session has: id, status (idle/queued/uploading/paused/success/error/canceled), path, progress (transferred/total/percent), timestamps, and result.

### Session Persistence (`persistence/localstorage.ts`)
- `UploadSessionPersistenceAdapter` — Interface for persisting upload session state
- LocalStorage implementation for surviving page refreshes

### React Integration (`react/`)
- `useUploadController()` — Hook for managing a single upload (start, pause, resume, cancel, progress)
- `useUploadFile()` — Simplified single-file upload hook
- `useUploadSessions()` — Track all active upload sessions

### Utilities
- `filename.ts` — Filename sanitization and extension extraction
- `path.ts` — Storage path construction helpers
- `retry.ts` — Retry logic with exponential backoff
- `file-size.ts` — File size formatting and validation

### Types (`types.ts`)
Full type definitions for: `UploadSessionStatus`, `UploadSessionState`, `UploadController`, `StartUploadArgs`, `UploadQueueOptions`, `UploadSessionPersistenceAdapter`, `DisposeUploadSessionArgs`.

## Key Design Decisions
- Resumable uploads are critical for large media files — they survive network interruptions.
- Upload queue enforces concurrency limits to avoid overwhelming the client or Firebase Storage.
- Session state uses a monotonic `version` counter to prevent stale state overwrites.
- Persistence adapter is pluggable — LocalStorage is the default but could be swapped for IndexedDB or other storage.
- Priority field on `StartUploadArgs` allows important uploads (e.g., profile photos) to jump the queue.

## Files
```
src/
  index.ts, types.ts
  storage/upload.ts, delete.ts
  queue/upload-queue.ts
  utils/upload-store.ts, filename.ts, path.ts, retry.ts, file-size.ts
  persistence/localstorage.ts
  react/
    index.ts
    use-upload-controller.ts, use-upload-file.ts, use-upload-sessions.ts
```
