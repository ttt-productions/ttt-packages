# Adopt @ttt-productions/media-schemas 0.14.15

**What:** The pending-media document schemas the factory builds are plain.
**Severity:** low
**Came from:** the Q-Sports stored-document-schemas-are-plain ttt-packages session

- **Package and version:** `@ttt-productions/media-schemas` 0.14.15.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards media-schemas q-core patch`.
- **What changed:**
  - `createPendingMediaSchemas` builds every pending-media state, its result, the archived states
    and the quarantined archive row as plain objects (RULE-STD-BACKEND-115): an undeclared field is
    dropped on read instead of refused. Its stored `clientContext` and `clientMediaClaim` are plain
    `.strip()` copies of `ClientContextSchema` / `ClientMediaClaimSchema`.
  - `ClientContextSchema` and `ClientMediaClaimSchema` themselves stay strict, so every callable
    input that uses them (ttt-core's start-upload input and upload variables) is unchanged.
- **What the app must change:** Install. ttt-core's `pendingMedia` and `pendingMediaArchive` reads
  become plain with it; a ttt-prod test that expects one of them to refuse an extra field now
  expects the field dropped. ttt-core's own `__tests__/media-pending-media.test.ts` already says
  so in ttt-packages (test only, no ttt-core release).
- **Done when:** The lockfiles name `@ttt-productions/media-schemas` 0.14.15 or later and the tests
  pass.
