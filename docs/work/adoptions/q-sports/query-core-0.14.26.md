# Adopt @ttt-productions/query-core 0.14.26

**What:** The Firestore hooks drop their suppressed `exhaustive-deps`.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/query-core` 0.14.26.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `useFirestoreDoc`, `useFirestoreCollection`, `useFirestorePaginated` and `useFirestoreLiveInfinite` hold the query key and constraints by their serialized identity and read an inline `select` through a ref, with no suppressed `exhaustive-deps`. Behaviour is unchanged: an equal key, an equal constraint list and a new inline `select` still keep one subscription.
  - `useBatchFirestoreDocs<T extends DocumentData>` constrains `T` like its sibling hooks.
- **What the app must change:** Install only.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.26 or later, and the gate is green.
