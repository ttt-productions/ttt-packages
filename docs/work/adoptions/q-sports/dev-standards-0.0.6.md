# Adopt @ttt-productions/dev-standards 0.0.6

**What:** The shared `.gitattributes` copy pins LF line endings.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (second package release)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.6.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ttt-core patch`.
- **What changed:** `config/copies/.gitattributes` is `* text=auto eol=lf`, so a checkout writes LF whatever `core.autocrlf` says (Git for Windows ships it `true`, which writes CRLF). It pairs with repo-guards 0.1.21's `lineEndings` guard.
- **What the app must change:** Install. Set the repo's own `.gitattributes` to `* text=auto eol=lf`, so the config-copy drift test matches the shared copy.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.6 or later, and the config-copy drift test passes.
