# @ttt-productions/media-processing-core

Generic server-side media processing package.

## Owns

- I/O-agnostic media pipeline
- Image/video/audio processing helpers
- Temp workspace and processing adapter utilities
- Server Firebase Storage adapter on `./server`

## Boundary

The package consumes generic media shapes from `media-schemas` and keeps Firebase Admin as a peer/runtime concern. TTT processors own collection paths, moderation policy, storage relocation, and app-specific side effects.

The root entry (`.`) is one of only two intentional exceptions to the monorepo's root-purity rule (see `package-architecture.md`) — it is Node-only (spawns `ffmpeg` via `node:child_process`, uses `node:fs`/`node:os`), not a universal/server-safe surface like every other package's root.

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
