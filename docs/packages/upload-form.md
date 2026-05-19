# @ttt-productions/upload-form

Deferred-upload form primitives. Composes `@ttt-productions/file-input` (MediaInput UI) with `@ttt-productions/upload-core` (resumable Storage upload) for forms that defer the Firebase Storage upload until form submit — the user selects a file, the shell holds it locally, and the actual byte upload happens inside the mutation triggered by the submit handler.

## Version
0.1.0

## Dependencies
Runtime: @ttt-productions/file-input, @ttt-productions/upload-core, @ttt-productions/media-contracts.
Peer: firebase, react, react-dom.

## Entry Points

- `@ttt-productions/upload-form` — server-safe (intentionally empty; the public API is React-only).
- `@ttt-productions/upload-form/react` — `LocalUploadGuardProvider`, `useLocalUploadGuard`, `useGuardedUpload`, `DeferredUploadFormShell`.

## What It Contains

### React entry point (`react/index.ts`)
- `LocalUploadGuardProvider` — Tracks in-flight local byte uploads and installs a `beforeunload` listener while the count is > 0. Mount once near the root of the app inside upload-capable trees.
- `useLocalUploadGuard()` — Returns `{ activeUploadCount, registerUpload, unregisterUpload }`. Throws if used outside a provider. Most consumers use it indirectly via `useGuardedUpload`.
- `useLocalUploadGuardContext()` — Lower-level context accessor. Same return shape as `useLocalUploadGuard`. Exported for advanced use cases.
- `useGuardedUpload()` — Returns an async function that wraps `uploadFileResumable` with phase reporting (`preparing → uploading → finalizing`), guard registration, and a `finally`-block guard unregister. The canonical helper every upload-capable mutation hook must use.
- `DeferredUploadFormShell` — `forwardRef` component that owns the selected-file state, the upload-state phase, an aria-live focus target, and submit gating against `mutation.isPending`. Imperative API: `ref.current.submit()`.

## Key Design Decisions
- Main entry is intentionally empty. React-only code stays behind `./react` to preserve the server-safe contract.
- The shell's `submit` is imperative (via `forwardRef` + `useImperativeHandle`). Forms control their own submit button to gate on form-level validity (e.g. require-a-file).
- `useGuardedUpload` does NOT clear `onProgress` to `null` on completion — callers do that from their mutation's `onSuccess`/`onError` to bracket the full mutation lifecycle, not just the upload window.
- `LocalUploadGuardProvider` covers the `preparing` and `uploading` phases only. `finalizing` is excluded because bytes are already in Storage and only a callable remains.

## Files
```
src/
  index.ts                                       (empty — server-safe placeholder)
  react/
    index.ts                                     (barrel)
    local-upload-guard-provider.tsx
    use-guarded-upload.ts
    deferred-upload-form-shell.tsx
__tests__/
  deferred-upload-form-shell.test.tsx
```
