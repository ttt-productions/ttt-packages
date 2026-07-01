# @ttt-productions/upload-ui

Guarded upload UI/mechanism package. This replaces the old `upload-form` package name.

## Owns

- `@ttt-productions/upload-ui/react/upload` exports `useGuardedUpload` and `DeferredUploadFormShell`
- `@ttt-productions/upload-ui/react/guard` exports `LocalUploadGuardProvider`, `useLocalUploadGuard`, `GuardedLink`, and `useGuardedNavigation` (plus the lower-level `useLocalUploadGuardContext` — most consumers should use `useLocalUploadGuard` instead)
- `@ttt-productions/upload-ui/react/tray` exports the upload activity provider/hook/tray primitives and upload processing cleanup helpers, including `useMarkUploadActivitySeen` and `useUploadProcessing`
- A metadata-derived **uploads source state** on the in-flight-uploads provider: `useUploadsSourceState()` returns `'connecting' | 'live' | 'offline' | 'error'` (`UploadsSourceState`), derived from `snapshot.metadata.fromCache` (the default subscription now opens with `{ includeMetadataChanges: true }`) plus the listener error callback, and resets on user-identity change. Mirrors `query-core`'s `FirestoreSourceState` so the Files source of the notification tray can show a degraded indicator instead of a false "all caught up". The injected `FirestoreSubscribeFn` snapshot gained an optional `metadata.fromCache`; injected test fakes may omit it (absent ⇒ server-confirmed).

## Boundary

`upload-ui` owns mechanism and UI state, not TTT policy. The receive-side provider is adapter-driven: app code supplies the user id, Firestore/pending-media subscription details, parser/schema, domain-event notification callback, toast/rejection/error callbacks, success copy, and clear-activity mutation.

The deferred form shell receives a neutral `MediaOriginSpec`. TTT chooses the concrete spec from `ttt-core` at the app boundary.

## Does not own

- Low-level Firebase Storage upload primitive (`upload-core` owns that)
- TTT file origins or `TTT_MEDIA_SPECS`
- TTT pending-media schema
- TTT toast/rejection copy


## Entry points

The package main entry (`@ttt-productions/upload-ui`) is intentionally server-safe and empty. React runtime exports are deliberately split by concern:

- `./react/upload` — local upload helper and deferred form shell.
- `./react/guard` — local upload guard, guarded links, and guarded navigation.
- `./react/tray` — global upload activity subscriber, tray, and clear helpers.

There is no catch-all `./react` subpath; import the specific concern.
