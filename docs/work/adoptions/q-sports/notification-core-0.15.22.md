# Adopt @ttt-productions/notification-core 0.15.22

**What:** `useNotificationHistory` drops an `archivedAt` fallback no stored history row can reach.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/notification-core` 0.15.22.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers media-processing-core moderation-core monitoring-core notification-core query-core repo-guards ttt-core upload-core patch`.
- **What changed:** The history read's `select` takes each row's `archivedAt` as stored, with no `?? snapshot.updatedAt ?? 0` fallback. The read orders by `archivedAt`, so Firestore never returns a history document without one, and the one writer (`archiveNotificationWithGeneration`) always writes a number. Nothing exported changed.
- **What the app must change:** Install. If the app writes history rows any other way, each must carry a numeric `archivedAt` (its schema already requires one).
- **Done when:** The lockfiles name 0.15.22 or later.
