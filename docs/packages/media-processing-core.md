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

`MediaObjectStore` (`src/server/storage-ops.ts`) is the chokepoint for every final-media write, copy, read-back, and delete: `putFile` (content type + immutable cache-control), `copy` (server-side), `readToFile` (streamed to disk), and `delete` (a missing object is a no-op). Writes return object keys, never URLs; display URLs are built at render time by the consuming app.

**Keys are write-once.** Every object is written `public, max-age=31536000, immutable`, so replacing media means writing it under a NEW key and repointing the app's reference; overwriting an existing key would keep serving the old bytes from caches for up to a year.

The consuming app picks one store per environment:

- **R2** (`createR2ObjectStore`) — S3-compatible, with bounded transient retry for put/copy/read; delete is one-shot.
- **Firebase Storage** (`createFirebaseStorageObjectStore`) — for deployed environments that keep final media in Firebase Storage. Token-free: `putFile` writes no download token, and `copy` strips any token the source object carried, so the store's objects are readable only through the app's own access path (Storage rules). The strip is pinned to the rewritten object's metageneration so the library retries it; if it still fails, the copy deletes the destination and throws, and never leaves the object live with the source's token. The store guarantees only what it writes: Firebase can mint a token later (a client `getDownloadURL`, the console), so the app's read path must never mint one.
- **Firebase Storage emulator** (`createFirebaseEmulatorObjectStore`) — local dev and tests only. It is the Firebase Storage store with a fixed caller-supplied download token stamped on every object, so deterministic emulator URLs work. It is never used in a deployed environment.

The two Firebase stores are one implementation that differs only in token policy — a behavior change to either is made once. `createObjectStoreMediaIO` reads the staged upload from Firebase Storage (optionally pinned to a generation) and writes processed outputs through whichever store the app passes.

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
- **`readStagedUploadMetadata(bucket, path)`** reads the staged object's stored metadata for `verifyStagedUploadMetadata` (`{ found: false }` for a missing object; any other failure throws). **`readStagedObjectGeneration(bucket, path, { onReadFailure? })`** captures the staged object's generation — the one value that pins every later read (the processing download, a moderation scan via **`pinnedGcsUri`**, a hash) to the same immutable bytes. It is best effort: `undefined` when unreadable, and reads then stay unpinned behind the create-only staging rule.
