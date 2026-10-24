# Adopt @ttt-productions/upload-ui 0.7.21

**What:** The in-flight uploads subscription passes its callbacks typed, with no cast.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/upload-ui` 0.7.21.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `defaultFirestoreSubscribe` hands the SDK typed wrapper callbacks. No behavior changes.
- **What the app must change:** Install. Nothing else.
- **Done when:** The lockfiles name 0.7.21 or later.
