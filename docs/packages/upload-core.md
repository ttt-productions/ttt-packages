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
