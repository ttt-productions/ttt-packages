# @ttt-productions/upload-core

Firebase Storage upload system with resumable uploads, progress tracking, upload queuing with concurrency control, and session persistence. Handles the actual file transfer after file-input prepares the files.

## Version
0.2.0

## Dependencies
Runtime: @ttt-productions/firebase-helpers.
Peer: firebase, react.

## Entry Points

- `@ttt-productions/upload-core` — server-safe types, error class + content-type guard, pure utilities (filename/path/file-size), and the in-memory upload-session store.
- `@ttt-productions/upload-core/browser` — browser-runtime surfaces: Firebase Storage upload/delete, the upload queue, and the LocalStorage persistence adapter.
- `@ttt-productions/upload-core/react` — React upload hooks.

## What It Contains

### Main entry point (`index.ts`) — server-safe
- Types from `types.ts`
- `UploadError`, `isValidMediaContentType(ct)` (content-type guard for `image/*`, `video/*`, `audio/*`)
- Filename/path helpers: `normalizeFilename`, `buildUploadPath`
- `getFileSize(file)` pure Blob/File size accessor
- In-memory upload-session store: `getUploadSession`, `listUploadSessions`, `upsertUploadSession`, `removeUploadSession`, `subscribeUploadSession`, `subscribeUploadSessionsList`, `pruneOldUploadSessions`, `rehydrateUploadSessions`, `setUploadSessionPersistence`, `setUploadSessionPersistenceErrorHandler`

### Browser entry point (`browser/index.ts`)
- `uploadFileResumable(args)`, `startResumableUpload(args)` — Firebase Storage resumable uploads
- `deleteFile(args)` — Firebase Storage delete
- `UploadQueue` — concurrency-limited queue
- `createLocalStorageUploadSessionPersistence(opts?)` — `window.localStorage`-backed persistence adapter

### React entry point (`react/index.ts`)
- `useUploadController()` — Hook for managing a single upload (start, pause, resume, cancel, progress)
- `useUploadFile()` — Simplified single-file upload hook
- `useUploadSessions()` — Track all active upload sessions

### Error types & content-type guard
- `UploadError` — Typed error class with `code: 'missing_content_type' | 'invalid_content_type'`. Throw before any bytes hit Firebase Storage when metadata.contentType is empty or not a valid media MIME.
- `isValidMediaContentType(ct)` — Predicate for `image/*`, `video/*`, `audio/*`. Rejects empty strings and `application/octet-stream`.
- `uploadFileResumable` (on `/browser`) guards contentType at the top; consumers catch `UploadError` via `instanceof` or `err.code`.

## Key Design Decisions
- Resumable uploads are critical for large media files — they survive network interruptions.
- Upload queue enforces concurrency limits to avoid overwhelming the client or Firebase Storage.
- Session state uses a monotonic `version` counter to prevent stale state overwrites.
- Persistence adapter is pluggable — LocalStorage is the default but could be swapped for IndexedDB or other storage.
- Priority field on `StartUploadArgs` allows important uploads (e.g., profile photos) to jump the queue.
- Entry-point split: server-safe types/utilities/store on main, Firebase Storage runtime on `/browser`, React hooks on `/react`. Main is importable from Cloud Functions / SSR contexts without dragging in `firebase/storage` or browser globals.

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
  browser/
    index.ts
  react/
    index.ts
    use-upload-controller.ts, use-upload-file.ts, use-upload-sessions.ts
```
