# @ttt-productions/upload-core

Firebase Storage upload system with resumable uploads, progress tracking, upload queuing with concurrency control, and session persistence. Handles the actual file transfer after file-input prepares the files.

## Version
0.1.2

## Dependencies
Runtime: @ttt-productions/firebase-helpers.
Peer: firebase, react.

## Entry Points

- `@ttt-productions/upload-core` — currently exports upload primitives, types, queue/store helpers, persistence, and Firebase Storage operations. This is a known server-safety violation until Storage runtime operations move behind an explicit browser/client subpath.
- `@ttt-productions/upload-core/react` — React upload hooks.

## What It Contains

### Main entry point (`index.ts`) — known server-safety exception
- Types from `types.ts`
- Storage operations: `uploadFileResumable(args)`, `deleteFile(args)`, `UploadError`, `isValidMediaContentType(ct)`
- Utilities: filename/path helpers, upload store, retry helpers
- Queue/persistence primitives: `UploadQueue`, `UploadSessionPersistenceAdapter`, LocalStorage persistence implementation

### React entry point (`react/index.ts`)
- `useUploadController()` — Hook for managing a single upload (start, pause, resume, cancel, progress)
- `useUploadFile()` — Simplified single-file upload hook
- `useUploadSessions()` — Track all active upload sessions

### Error types & content-type guard
- `UploadError` — Typed error class with `code: 'missing_content_type' | 'invalid_content_type'`. Throw before any bytes hit Firebase Storage when metadata.contentType is empty or not a valid media MIME.
- `isValidMediaContentType(ct)` — Predicate for `image/*`, `video/*`, `audio/*`. Rejects empty strings and `application/octet-stream`.
- `uploadFileResumable` guards contentType at the top; consumers catch `UploadError` via `instanceof` or `err.code`.

## Key Design Decisions
- Resumable uploads are critical for large media files — they survive network interruptions.
- Upload queue enforces concurrency limits to avoid overwhelming the client or Firebase Storage.
- Session state uses a monotonic `version` counter to prevent stale state overwrites.
- Persistence adapter is pluggable — LocalStorage is the default but could be swapped for IndexedDB or other storage.
- Priority field on `StartUploadArgs` allows important uploads (e.g., profile photos) to jump the queue.
- Current state: runtime upload primitives still live on main and React hooks stay behind `/react`. Desired state: keep pure/types/queue helpers on main and move Firebase Storage upload/delete runtime APIs behind an explicit browser/client subpath.

## Files
```
src/
  index.ts, types.ts
  storage/
    upload.ts, delete.ts, upload-error.ts
  queue/
    upload-queue.ts
  utils/
    upload-store.ts, filename.ts, path.ts, retry.ts, file-size.ts
  persistence/
    localstorage.ts
  react/
    index.ts
    use-upload-controller.ts, use-upload-file.ts, use-upload-sessions.ts
```
