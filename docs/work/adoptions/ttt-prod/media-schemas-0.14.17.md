# Adopt @ttt-productions/media-schemas 0.14.17

**What:** An origin's spec carries a second upload setting, `allowSignedOut`, beside `preserveOriginal`.
**Severity:** medium

- **Package and version:** `@ttt-productions/media-schemas` 0.14.17.
- **Release:** `./scripts/release-multiple.sh media-schemas upload-ui q-core patch`.
- **What changed:** `MediaOriginSpec` gains the optional `allowSignedOut` (a signed-out person may
  upload this origin; absent is signed in only), the second of an origin's two settings on the one
  upload path. `preserveOriginal` stays the kept-as-given setting.
  `docs/design/upload-path-invariant.md` § One path for every origin says the whole model.
- **What the app must change:** Install. Nothing else is needed for this release; ttt-prod's move of
  the take-it-down evidence onto the one path, where `ncii-evidence` would set `allowSignedOut: true`,
  is its own item, `docs/work/waiting-to-be-implemented/take-it-down-one-signed-out-upload-place.md`.
- **Done when:** The lockfiles name `@ttt-productions/media-schemas` 0.14.17 or later.
