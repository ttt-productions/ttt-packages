# Adopt @ttt-productions/media-processing-core 0.8.20

**What:** The Firebase store and the pending-media pipeline take narrow types.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/media-processing-core` 0.8.20.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `Bucket` is now the slice of a Cloud Storage bucket the store uses (`name`, `file()`, `upload()`, and an object's `getMetadata` / `download` / `copy` / `delete`), with `StorageObject`, `StorageObjectMetadata` and `StorageCopyOptions`; a copy names its destination by key in the same bucket. The pending-media functions take the `firebase-helpers/server` Firestore contract. A firebase-admin bucket, `db`, transaction, and reference are each passed as they are.
- **What the app must change:** Install. Delete any cast on a bucket, `db`, transaction, or reference passed to the package; a test fake is typed as these types.
- **Done when:** The lockfiles name 0.8.20 or later and the type check passes.
