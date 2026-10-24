# Adopt @ttt-productions/audit-core 0.7.6

**What:** audit-core writes through the firebase-helpers server Firestore contract and no longer needs firebase-admin.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/audit-core` 0.7.6.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `createAuditWriter` takes `db: ServerFirestore`, and `writeAuditEvent` an optional `ServerWriteBatch` or `ServerTransaction`, all from `@ttt-productions/firebase-helpers/server`. The `firebase-admin` peer is gone.
- **What the app must change:** Install. An Admin SDK `db`, batch, or transaction is passed as it is; delete any cast on them.
- **Done when:** The lockfiles name 0.7.6 or later and the type check passes.
