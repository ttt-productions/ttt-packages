# @ttt-productions/media-processing-core

Generic server-side media processing package.

## Owns

- I/O-agnostic media pipeline
- Image/video/audio processing helpers
- Temp workspace and processing adapter utilities
- The final-media object stores and the object-store `MediaIO` adapter on `./server` (see below)
- The Admin-SDK pending-media pipeline mechanics on `./server`: the crash-safe claim, the compare-and-set finalizer, and the staged-object reads (see below)

## Boundary

The package consumes generic media shapes from `media-schemas` and keeps Firebase Admin as a peer/runtime concern. TTT processors own collection paths, moderation policy, storage relocation, and app-specific side effects.

The root entry (`.`) is one of only two intentional exceptions to the monorepo's root-purity rule (see `package-architecture.md`) — it is Node-only (spawns `ffmpeg` via `node:child_process`, uses `node:fs`/`node:os`), not a universal/server-safe surface like every other package's root.

## Final-media object stores (`./server`)

`MediaObjectStore` (`src/server/storage-ops.ts`) is the chokepoint for every final-media write, copy, read-back, and delete: `putFile` (content type + immutable cache-control), `copy` (server-side, never overwrites), `readToFile` (streamed to disk), `delete` (a missing object is a no-op), and `deleteCopy` (deletes an object only when it is a copy of the named source — below). Writes return object keys, never URLs; display URLs are built at render time by the consuming app.

**Keys are write-once.** Every object is written `public, max-age=31536000, immutable`, so replacing media means writing it under a NEW key and repointing the app's reference; overwriting an existing key would keep serving the old bytes from caches for up to a year.

**Copy: never overwrites, idempotent, one call.** `copy({ fromKey, toKey })` reads the source's current version, then commits the destination only if `toKey` holds no object, in ONE call that writes it fully formed: exactly that source version's bytes, the source's content headers (content type, cache control, disposition, encoding), the copy's provenance, and the store's token policy. The destination either commits complete or does not commit; nothing is written afterwards, and a copy never deletes anything.

- **Provenance.** Every copy records on its destination the source key and the source version it copied (custom metadata `copy-source` and `copy-source-version`, URI-encoded). The copy is pinned to that exact source version, so the record always describes the bytes committed.
- **An existing destination.** When `toKey` already holds an object, the store reads that object's provenance. If it names this copy's source key and source version, the object IS this copy's result — a retry whose answer was lost, or an identical copy that committed first — and `copy` resolves `{ key, alreadyPresent: true }`. Anything else — a different source, another version of the same source, or an object with no provenance — throws `ObjectAlreadyExistsError` (recognized with `instanceof`; the key is its `key` property, never message text) and leaves that object untouched. The check never answers "same" on a guess: a missing or mismatched record is "different".
- **The source changing mid-copy.** A source replaced between its read and the copy fails the copy without writing (as not-found on Cloud Storage, as a `412` `R2StorageError` on R2); a retry copies the version then current.
- **Why provenance, not content hashes.** A content hash cannot prove "this copy wrote it": CRC32C and MD5 can be forged, a composite Cloud Storage object has no MD5, and an R2 multipart ETag is not a content hash and need not match its copy's. Provenance compares what the copy itself recorded.

**Delete a copy: only an object this package copied from that source.** `deleteCopy({ fromKey, toKey })` removes the object at `toKey` only when its own provenance names `fromKey` as its source, and resolves `'deleted' | 'absent' | 'notThisCopy'`. It reads nothing but the destination's metadata, so it works after the source is retired or deleted; for the same reason it matches the source key but not the source version (a record naming the source with no version is not this package's provenance). A missing object is `'absent'` (the structural not-found); an object copied from another source, or one with no provenance, is `'notThisCopy'` and stays untouched. A consumer reclaiming an abandoned copy therefore cannot delete another writer's object, even when its own key derivation is wrong. The provenance format stays private to the package.

- **Firebase Storage** closes the check-then-delete window: the delete carries `ifGenerationMatch` = the generation it checked, so it can remove only that object. A `412` means the object changed after the check; the store checks again (once) and decides from what is there now, never deleting blind, and rethrows the precondition failure if the object is still changing. A destination whose metadata names no generation is an `UnreadableStorageObjectMetadataError`, raised before anything is deleted.
- **R2 cannot close it.** R2's S3 API lists no conditional headers for DeleteObject (its PutObject and CopyObject list them), its S3 extensions add conditional-destination headers to CopyObject only, and its Workers binding's `delete()` takes no options. So the R2 store reads the destination, then sends one unconditioned DELETE, with no precondition header it would silently ignore. The gap between the two is harmless under the key contract: keys are write-once and a copy never replaces an existing object, so during the gap the checked object can only be removed; and a copy's key is derived from its source, so the only object that can land there afterwards is another copy of the same source. The destination read retries like any other read; the DELETE is one-shot, like `delete`.

**Errors carry keys as properties, never in message text.** An error the package throws can reach monitoring, and an object key or bucket must not travel with it. A failed R2 operation is an `R2StorageError` whose `operation`, `bucket`, `key`, `attempts`, `status`, `s3ErrorCode` (the S3 `<Code>` of the response body), and bounded body (`responseText`) are properties; its message names only the operation, the attempts, the status, and the S3 code, for humans — nothing classifies from it. Errors the Admin SDK itself raises are rethrown as they are. A guard test fails any error constructed in package source whose message interpolates a key, bucket, or path.

The consuming app picks one store per environment:

- **R2** (`createR2ObjectStore`) — S3-compatible, with bounded transient retry for put/copy/read (including `deleteCopy`'s destination read); every DELETE is one-shot. A copy reads its source with a GET whose body is discarded (a HEAD's error response has no body, so no S3 code). The copy is one CopyObject pinned to the source's ETag (`x-amz-copy-source-if-match`), conditioned on an absent destination by R2's `cf-copy-destination-if-none-match: *` extension (checked when the copy commits; S3's `x-amz-copy-source-if-*` headers condition only the source), with `x-amz-metadata-directive: REPLACE` so the destination takes exactly the carried content headers and the provenance as `x-amz-meta-*`. R2 exposes no object version id, so the source version is its ETag, last-modified time, and size together: replacing the source changes at least one of them unless the new content has the same MD5-derived ETag and lands within the same second. R2 answers `412` for both a changed source and an existing destination; the store reads the destination to tell them apart.
- **Firebase Storage** (`createFirebaseStorageObjectStore`) — for deployed environments that keep final media in Firebase Storage. Token-free: `putFile` writes no download token, and `copy` never carries the source's, so the store's objects are readable only through the app's own access path (Storage rules). The copy is one rewrite of the source's exact generation (`sourceGeneration`) with `ifGenerationMatch: 0`, sending the destination's full resource: a rewrite's resource REPLACES the destination's metadata rather than merging with the source's, so the destination commits with no token and with its provenance in the same call. The source version is its generation. A source whose metadata names no generation is an `UnreadableStorageObjectMetadataError`, raised before anything is written. The store guarantees only what it writes: Firebase can mint a token later (a client `getDownloadURL`, the console), so the app's read path must never mint one.
- **Firebase Storage emulator** (`createFirebaseEmulatorObjectStore`) — local dev and tests only. It is the Firebase Storage store with a fixed caller-supplied download token written on every object, so deterministic emulator URLs work. It is never used in a deployed environment. The Storage emulator honors the rewrite's metadata (it replaces the custom metadata and takes the token from it) but enforces no Cloud Storage preconditions and ignores `sourceGeneration`: there a copy onto an existing key replaces it and reports `alreadyPresent: false`, and a replaced source is copied at its current version. Local runs cannot exercise the copy's never-overwrite or identity guarantees, nor `deleteCopy`'s generation-conditioned delete.

The two Firebase stores are one implementation that differs only in token policy — a behavior change to either is made once. `createObjectStoreMediaIO` reads the staged upload from Firebase Storage (optionally pinned to a generation) and writes processed outputs through whichever store the app passes.

**`isObjectNotFoundError(e)`** is the one "the object does not exist" classifier, for both backends, and it decides from structured fields only — never message text: an `R2StorageError` with status `404` and `s3ErrorCode` `NoSuchKey` (an R2 `NoSuchBucket` is not a missing object), or a Cloud Storage Admin SDK error with the numeric code `404`. A message that says "No such object", or a string `"404"` code, is not a missing object. The stores' `delete` and `deleteCopy`, a copy's destination read, and `readStagedUploadMetadata` use it; a consumer deciding whether a failed store read, or its own Admin-SDK Storage call, hit a missing object calls it rather than re-testing codes.

## Canonical inspector + pipeline seam

`inspectMedia` (src/inspection/) is THE server classification authority: bounded 64KiB
signature routing, hardened `ffprobe` stream tables (timeout/kill/output-cap/strict schema)
for shared containers, sharp decode-proof for images (image-family ISO-BMFF resolved BEFORE
the timed-video rule — AVIF probes as an AV1 video stream), bounded codec normalization, and
the fail-closed table (anything unproven ⇒ indeterminate + strict-video-fallback; never
audio). `runCmd` gained `timeoutMs`/`signal` (SIGKILL) + `timedOut`/`truncated` flags.
`runMediaPipeline` gained the `resolveAfterInspection` seam: inspect the generation-pinned
temp input BEFORE moderation/processing, let the caller's policy adapter pick the spec (or
reject typed), and carry the SAME inspection object on every result path so the finalizer
hands it to the safety gate — one authority, no re-detection.
## Bounded-memory local-input primitives

`src/io/local-input.ts`: `streamToTempFile` (hard byte cap, private temp dir,
cleanup-on-failure, `ByteLimitExceededError`), `hashFileSha256` (streamed),
`readFileHeader` (bounded signature window, `FILE_HEADER_BYTES`). Safety
scanning/hashing consumers use these so a media source is never held fully in
JS memory; callers own generation pinning and `cleanup()` in `finally`.

## Pending-media pipeline mechanics (`./server`)

The Admin-SDK halves of the pending-media lifecycle; the decisions they apply are the pure ones in `media-schemas` (§ Pending-media lifecycle decisions). Every app-specific value is injected — the row's `DocumentReference` (no collection name lives here), the row schema, the claim policy, the extra writes, the clock — so both apps run the same mechanics.

- **`claimPendingMediaForProcessing(transaction, ref, { schema, policy, now? })`** reads the CURRENT row in the transaction, parses it with the app's schema (a row that no longer parses is `missing` and never dispatched), decides the claim, and applies the claim write. `busy` means a live attempt owns the row: the caller asks for redelivery and must not fail it.
- **`finalizePendingMediaInTransaction` / `finalizePendingMedia` / `finalizeUnparsablePendingMedia`** are the one terminal writer: re-read, compare-and-set, write the terminal fields only from a non-terminal row. `extraWrites` carries the caller's own writes that must commit atomically with the transition and only when it applies (a quota-reservation release, for example): it runs in the transaction's read phase and returns the write-phase step, so the compare-and-set makes it exactly-once. `finalizeUnparsablePendingMedia` fails a row whose status the transition table cannot read, and leaves any row with a terminal or unknown status untouched.
- **`readStagedUploadMetadata(bucket, path)`** reads the staged object's stored metadata for `verifyStagedUploadMetadata` (`{ found: false }` for a missing object; any other failure throws). **`readStagedObjectGeneration(bucket, path, { onReadFailure? })`** captures the staged object's generation — the one value that pins every later read (the processing download, a moderation scan via **`pinnedGcsUri`**, a hash) to the same immutable bytes. It is best effort: `undefined` when unreadable, and reads then stay unpinned behind the create-only staging rule. **`stagedObjectGenerationFromMetadata(metadata)`** is the one normalization it applies (the generation as a string; `undefined` when absent, `null`, or an empty string), for a processor that already holds the object's metadata and must not read it again.
- **`requireStorageObjectGeneration(metadata, { bucket, key })`** is the same normalization for a site that cannot proceed without a generation (a hold key, an evidence record, a pinned read): it throws **`UnreadableStorageObjectMetadataError`** instead of returning `undefined`. The error names the `field` (`'generation'` or `'size'`, so a byte-size check reports through the same class) and carries `bucket` / `key` as properties, never in the message, so an object key never reaches monitoring. Every storage-object metadata anomaly surfaces through this one class; no caller substitutes a placeholder.
