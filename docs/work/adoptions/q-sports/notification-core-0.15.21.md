# Adopt @ttt-productions/notification-core 0.15.21

**What:** notification-core takes the firebase-helpers server Firestore contract.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/notification-core` 0.15.21.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `./server` no longer exports `ServerFirestore`, `ServerTransaction`, `ServerDocRef` or the rest of that family; its handlers take the one contract from `@ttt-productions/firebase-helpers/server`.
- **What the app must change:** Install. Move every import of those types to `@ttt-productions/firebase-helpers/server`.
- **Done when:** The lockfiles name 0.15.21 or later and the type check passes.
