# Every upload goes through one path, with per-origin settings

**What:** every uploaded file, in every app, goes through the one staging path and the one server
check; an origin's spec says whether the file is processed or kept as given, and whether a signed-out
person may upload it. A signed-out upload uses the same path with a fixed signed-out owner segment in
place of a user id.
**Severity:** medium
**Came from:** DJ, in the Q-Sports 2.0 orchestrator, in place of a drafted "three upload lanes" rule
(processed, kept verbatim, signed out): those are settings of one upload, not separate systems.

## As it is today (checked in the code)

- The one staging path is `uploads/{fileOrigin}/{uid}/{id}`; each app owns its path builder, its
  origin registry, its `storage.rules` and the server-side path-equality check
  (`docs/design/upload-path-invariant.md`). media-schemas owns the neutral `MediaOriginSpec`, the
  pending-media factory and the staged-upload verdict; media-processing-core processes media.
- Q-Sports' signatures stage on that path and pass the same check, then leave it for a side system of
  their own: a copy intent (`signatureCopyIntents/{stagingId}`), a byte-for-byte copy to the kept path
  (`promoteStagedSignature`) and a reap pass for stranded copies.
- ttt-prod's take-it-down request uploads signed out to two paths of its own outside the staging tree
  (`nciiEvidence/…`, `nciiAuthorityEvidence/…`), with their own `storage.rules` blocks.

## The decision

- One path, one check, one record of the upload, for every origin.
- Each origin's spec carries two settings: **processed** or **kept as given** (never processed, kept
  byte for byte, such as a signature), and **signed in** or **signed out allowed**.
- A signed-out upload goes to the same path with a fixed owner segment (for example `signed-out`)
  where a user id would be; the value can never be a real user id. Its rules allow create only, only
  for origins whose spec allows signed out, with App Check, a size cap and the origin's content type.
  "Is this your file?" is answered by the unguessable id the uploader holds, not a user id. The server
  reads the stored bytes before using the file, and a sweep deletes signed-out uploads never used.

## The work (packages)

- The shared parts the one path needs, wherever a shared package owns them — for example the two
  settings on media-schemas' `MediaOriginSpec`, the kept-as-given kind on the pending-media shape and
  its lifecycle, and the staged-upload verdict for a signed-out owner. The builder confirms each part
  in the code. No app's origins, paths or copy enter a package (RULE-STD-ARCH-201).
- `docs/design/upload-path-invariant.md` says it, to RULE-STD-MEDIA-002 ("One upload path",
  dev-standards 0.0.26).
- Adoption files for both apps. Each app's move is its own item: Q-Sports
  `docs/work/projects/migration-2.0/code-changes/one-upload-path.md`; ttt-prod
  `docs/work/waiting-to-be-implemented/take-it-down-one-signed-out-upload-place.md`.
- `docs/work/do-later/new-packages/agreement-and-signature-package.md` keeps a signature as a
  kept-as-given upload on this path, with no copy intent of its own.

**Done when:** the shared parts are released, documented and green in `npm run test:quiet`, the
invariant doc says it, and both apps' adoption files are written.
