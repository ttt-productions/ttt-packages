# Upload path invariant

This doc describes the durable upload path shape used by TTT upload surfaces and the shared upload packages.

## Current package ownership

- `media-schemas` owns generic media shapes and the neutral `MediaOriginSpec` shape.
- `ttt-core` owns concrete `FileOrigin`, concrete `TTT_MEDIA_SPECS`, upload target-info schemas, `StartUploadRequestSchema`, and `parseTargetInfo`.
- `upload-core` owns the low-level browser upload primitive.
- `upload-ui` owns guarded upload UX and is the only feature-level caller of the low-level primitive.
- TTT app/backend code owns concrete storage path builders and Firestore rule alignment.

## Invariant

Every upload path is built from an app-approved origin id and app-owned path builder. Generic packages must treat the origin id as opaque. They may validate a file against a `MediaOriginSpec`, but they must not know the TTT `FileOrigin` enum or the concrete registry.

For TTT, upload `targetInfo` is also not authoritative for identity. Backends derive identity-bearing fields such as `createdBy`, `userId`, `actorId`, owner/admin fields, and notification recipients from the authenticated caller, `pendingMedia.userId`, or an explicitly checked admin/system context. A client-supplied target-info field can provide domain copy and typed ids, but it cannot be the source of truth for who performed or owns the write.

For TTT, the allowed origin ids must stay aligned across:

- `ttt-core` `FileOrigin`
- `ttt-core` `TTT_MEDIA_SPECS`
- backend `startUpload` / processor dispatch
- Firestore and Storage rules
- app upload form/shell wiring

## Package rule

Do not add a TTT origin to a generic package. Add it to `ttt-core`, update the backend processor/rules, and pass the selected `MediaOriginSpec` into the generic UI package at the app boundary.
