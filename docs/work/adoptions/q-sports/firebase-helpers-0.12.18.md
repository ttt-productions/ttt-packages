# Adopt @ttt-productions/firebase-helpers 0.12.18

**What:** firebase-helpers owns the one server Firestore contract.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.18.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `./server` exports `ServerFirestore`, `ServerTransaction`, `ServerCollectionRef`, `ServerQuery`, `ServerQuerySnapshot`, `ServerDocSnapshot`, `ServerDocRef` and `ServerWriteBatch` — the structural slice of the Admin SDK every server package handler takes. They used to be declared twice, in notification-core and report-core, which now import them from here. An Admin SDK `db`, transaction, or reference is one as it is.
- **What the app must change:** Install. Import any of those types from `@ttt-productions/firebase-helpers/server` (no longer from notification-core or report-core). Delete every cast that only existed to pass an Admin SDK `db` or transaction to a package handler — none is needed.
- **Done when:** The lockfiles name 0.12.18 or later, nothing imports a `Server*` Firestore type from notification-core or report-core, and the type check passes.
