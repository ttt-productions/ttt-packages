# Adopt @ttt-productions/dev-standards 0.0.7

**What:** The rules name the new guards: no blanket cast, LF line endings, no e2e retry that acts or swallows.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.7.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** RULE-STD-QUALITY-004 now says a spec acts once then asserts — no action or navigation inside a retry loop except a reviewed outcome-verified helper or polling, and no caught action or state read — enforced by `retryLoopActions` and `swallowedE2eActions`. RULE-STD-QUALITY-006 now says every text file is LF (`.gitattributes` `* text=auto eol=lf`, the `lineEndings` guard) and no `as never` / `as unknown as` cast outside a reviewed entry (`blanketCasts`). Hygiene steps 28 and 73 and the crosswalk carry them.
- **What the app must change:** Install. The work these rules require is the repo-guards 0.1.22 adoption.
- **Done when:** The lockfiles name 0.0.7 or later.
