# @ttt-productions/upload-core

Low-level browser upload runtime package.

## Owns

- Resumable Firebase Storage upload primitive
- Browser upload queue/runtime
- Upload session persistence and neutral session key prefix
- Types/utilities for the low-level upload layer

## Boundary

Feature code must not call the low-level upload primitive directly. Upload-capable UI goes through `@ttt-productions/upload-ui/react/upload` and its `useGuardedUpload` helper; navigation protection lives in `/react/guard`, and upload activity/tray state lives in `/react/tray`.

The historical `./react` subpath was removed. Do not reintroduce unguarded upload hooks.

## Result and cancellation

A finished upload resolves `UploadFileResumableResult` = `{ fullPath, contentType, size }`. The
primitive never mints a download URL: a staged upload is read only by the backend, and a download-token
link would be a public, never-expiring address for unscanned bytes.

A cancel the upload asked for — its `AbortSignal` aborting, or its controller's `cancel()` — rejects
with the canonical `DOMException` named `AbortError` and records the session `canceled`, including when
the Storage SDK reports it as its own `storage/canceled` error. A `storage/canceled` the upload did not
ask for stays a real error. Consumers treat `AbortError` as a user cancel, never as a failure.

## Neutral content-type opt-in

`uploadFileResumable` accepts `allowNeutralContentType: true` to permit EXACTLY
media-schemas' `NEUTRAL_CONTENT_TYPE` (`application/octet-stream`: unknown picker metadata reaching the server uninvented). The
media-only default is unchanged for every caller that omits it; arbitrary declared types still
reject.
