# Adopt @ttt-productions/media-processing-core 0.8.21

**What:** Every ffmpeg / ffprobe process starts through one internal function; no API change.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/media-processing-core` 0.8.21.
- **Release:** `./scripts/release-multiple.sh firebase-helpers media-processing-core monitoring-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** `runCmd` and `runFfmpeg` start their process through `spawnPiped` (`src/video/spawn-piped.ts`): stdin ignored, stdout and stderr piped, as before. Nothing exported changed, and behavior is unchanged.
- **What the app must change:** Install; nothing else changes.
- **Done when:** The lockfiles name 0.8.21 or later.
