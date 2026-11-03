# Adopt @ttt-productions/upload-ui 0.7.22

**What:** The upload tray's adapter can name the origins it follows; rows of any other origin are ignored.
**Severity:** low
**Came from:** the Q-Sports one-upload-path ttt-packages session

- **Package and version:** `@ttt-productions/upload-ui` 0.7.22.
- **Release:** `./scripts/release-multiple.sh media-schemas upload-ui q-core patch`.
- **What changed:** `InFlightUploadsAdapter` gains the optional `tracksOrigin(fileOrigin)`. A
  pending-media row whose origin it answers `false` for is never listed in the tray and fires no
  completed, failed, or rejected callback. Absent, every origin is followed, as before.
- **What the app must change:** Install. When the take-it-down evidence moves onto the one upload
  path (`docs/work/waiting-to-be-implemented/take-it-down-one-signed-out-upload-place.md`), a
  kept-as-given origin with no processing to report is left out of the tray through it.
- **Done when:** The lockfiles name `@ttt-productions/upload-ui` 0.7.22 or later.
