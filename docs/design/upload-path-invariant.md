# Upload path invariant

The durable upload path shape the shared upload packages rely on, and who owns each part of it.

## Package ownership

- `media-schemas` owns generic media shapes and the neutral `MediaOriginSpec` shape.
- `upload-core` owns the low-level browser upload primitive.
- `upload-ui` owns guarded upload UX and is the only feature-level caller of the low-level primitive.
- Each consuming app owns its concrete origin ids and origin registry (in its application-data
  package), its upload target-info and start-upload schemas, its concrete storage path builders, and
  the server-side path-equality check that enforces this invariant.

## Invariant

Every upload path is built from an app-approved origin id and an app-owned path builder. Generic
packages treat the origin id as opaque: they may validate a file against a `MediaOriginSpec`, but
they never know an app's origin enum or its concrete registry.

Upload target info is never authoritative for identity. The app's backend derives identity-bearing
fields (creator, owner, actor, notification recipients) itself. A client-supplied target-info field
may carry domain copy and typed ids, never the source of truth for who performed or owns the write.

Each app keeps its allowed origin ids aligned across its own origin registry, its upload processor
dispatch, its storage access rules, its server-side path check, and its upload form wiring — that alignment is the app's rule, not the packages'.

## One path for every origin

Every uploaded file, in every app, goes through the one staging path `uploads/{fileOrigin}/{owner}/{id}`,
the one server check, and the one pending-media record (RULE-STD-MEDIA-002). What differs between
origins is two settings on the origin's `MediaOriginSpec`, never a path of its own:

- **Processed or kept as given** (`preserveOriginal`). A processed origin's file goes to a processor;
  a kept-as-given file (a signature, say) is stored byte for byte and never processed, with no copy
  record or reap of its own.
- **Signed in or signed out allowed** (`allowSignedOut`). A signed-out upload uses the same path
  with the app's one fixed signed-out owner segment where a uid would be, a value that can never be
  a real user id. Its storage rules allow create only, only for origins that allow signed out, with
  App Check, a size cap and the outer content-type shape. The uploader's claim to the file is the
  unguessable id it holds; the server reads the stored bytes before using the file, and a sweep
  deletes signed-out uploads never used.

The app declares its origins, both settings for each, and its signed-out owner segment in its
application-data package; the packages only carry the neutral settings.

## Package rule

Never add an app's origin to a generic package. The app adds it to its own registry and backend, then
passes the selected `MediaOriginSpec` into the generic UI package at its boundary.
