# @ttt-productions/upload-ui

Guarded upload UI/mechanism package. This replaces the old `upload-form` package name.

## Owns

- `@ttt-productions/upload-ui/react/upload` exports `useGuardedUpload` and `DeferredUploadFormShell`
- `@ttt-productions/upload-ui/react/guard` exports `LocalUploadGuardProvider`, `useLocalUploadGuard`, `GuardedLink`, and `useGuardedNavigation` (plus the lower-level `useLocalUploadGuardContext` — most consumers should use `useLocalUploadGuard` instead)
- `@ttt-productions/upload-ui/react/tray` exports the upload activity provider/hook/tray primitives and upload processing cleanup helpers, including `useMarkUploadActivitySeen` and `useUploadProcessing`
- A metadata-derived **uploads source state** on the in-flight-uploads provider: `useUploadsSourceState()` returns `'connecting' | 'live' | 'offline' | 'error'` (`UploadsSourceState`), derived from `snapshot.metadata.fromCache` (the default subscription now opens with `{ includeMetadataChanges: true }`) plus the listener error callback, and resets on user-identity change. Mirrors `query-core`'s `FirestoreSourceState` so the Files source of the notification tray can show a degraded indicator instead of a false "all caught up". The injected `FirestoreSubscribeFn` snapshot gained an optional `metadata.fromCache`; injected test fakes may omit it (absent ⇒ server-confirmed).
- **One-shot terminal callback semantics** on the in-flight-uploads provider: a subscription's initial snapshot is a re-listing and never fires callbacks (refresh dedup) — with one exception: a doc this provider instance previously tracked as non-terminal fires when the initial listing shows it terminal (the transition completed during a same-identity resubscribe gap). In LIVE (non-initial) snapshots, every not-yet-fired terminal fires — including a doc whose first client-visible state is already terminal, because a fast backend outcome can coalesce created→terminal into one delivery while the uploader is actively waiting on the callback. Terminal dedup and status tracking are identity-scoped (they survive same-user resubscribes; a real user-identity change resets them).

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

## Neutral content-type threading

`GuardedUploadArgs.allowNeutralContentType` threads the upload-core opt-in through the one
guarded upload path (no TTT policy here — the app's policy adapter decides when to set it).

## Deferred-shell claim threading

`DeferredUploadFormShell` captures `MediaInputChangePayload.claim` beside the selected file,
passes it to `buildVariables` as an additive optional 4th argument, and clears it whenever the
file clears (user clear, post-success reset, abort reset) — a stale claim can never ride a new
submission.
