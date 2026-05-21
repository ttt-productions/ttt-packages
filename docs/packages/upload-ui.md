# @ttt-productions/upload-ui

Guarded upload UI/mechanism package. This replaces the old `upload-form` package name.

## Owns

- `LocalUploadGuardProvider` and `useLocalUploadGuard`
- `useGuardedUpload`, the only allowed caller of `uploadFileResumable` for feature upload surfaces
- Deferred upload form shell
- Guard-aware navigation helpers such as `GuardedLink` and `useGuardedNavigation`
- Upload activity provider/hook/tray primitives
- Upload processing cleanup helpers

## Boundary

`upload-ui` owns mechanism and UI state, not TTT policy. The receive-side provider is adapter-driven: app code supplies the user id, Firestore/pending-media subscription details, parser/schema, domain-event notification callback, toast/rejection/error callbacks, success copy, and clear-activity mutation.

The deferred form shell receives a neutral `MediaOriginSpec` plus an opaque origin id. TTT chooses the concrete spec from `ttt-core` at the app boundary.

## Does not own

- Low-level Firebase Storage upload primitive (`upload-core` owns that)
- TTT file origins or `TTT_MEDIA_SPECS`
- TTT pending-media schema
- TTT toast/rejection copy
