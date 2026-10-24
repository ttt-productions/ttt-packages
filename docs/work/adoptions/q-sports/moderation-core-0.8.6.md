# Adopt @ttt-productions/moderation-core 0.8.6

**What:** The moderators take the one client call each makes.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/moderation-core` 0.8.6.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `moderateImage`'s `getClient` resolves a `SafeSearchClient` and `moderateVideo`'s an `AnnotateVideoClient` — each the one vendor call it makes. The real clients are each one.
- **What the app must change:** Install. A test client is typed as these, with no cast.
- **Done when:** The lockfiles name 0.8.6 or later.
