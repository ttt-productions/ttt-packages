# Adopt @ttt-productions/notification-core 0.15.19

**What:** Archive mutations are session-bound; the lists gain a per-row content slot.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/notification-core` 0.15.19.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** `useArchiveNotification` and `useArchiveAllNotifications` run on query-core's `useSessionMutation`; Clear All stops polling once the session ends. `NotificationList` and `NotificationHistoryList` take `renderContent?: (notification) => ReactNode`, which renders in place of the stored title and message; without it the stored text shows. The `@tanstack/react-query` peer floor is `>=5.90.0`.
- **What the app must change:** Install `@ttt-productions/notification-core@latest` with query-core. Use `renderContent` for any notification type whose text the app resolves at render.
- **Done when:** The lockfiles name `@ttt-productions/notification-core` 0.15.19 or later and the gate is green.
