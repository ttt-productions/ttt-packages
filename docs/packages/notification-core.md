# @ttt-productions/notification-core

Two-tier notification system: active (unread) → history (archived). Supports deduplication, batch processing, user and admin notification categories, and themed UI components. Has server-safe types, client-side React hooks/components, and server-side Cloud Function helpers.

## Version
0.2.3

## Dependencies
Peer: @tanstack/react-query, @ttt-productions/query-core, @ttt-productions/ui-core, firebase, react, react-dom.

## Entry Points

- `@ttt-productions/notification-core` — server-safe types only.
- `@ttt-productions/notification-core/react` — React hooks and components.
- `@ttt-productions/notification-core/server` — Cloud Function helpers and server types.
- `@ttt-productions/notification-core/styles` — CSS side-effect import.

## What It Contains

### Server-safe main entry (`index.ts`)
Type exports from `types.ts`:
- `NotificationDoc`, `NotificationHistoryDoc`, `ArchivalInfo`, `PendingNotification`
- `NotificationCategoryConfig`, `NotificationTypeConfig`, `NotificationSystemConfig`
- Hook option/result prop types and component prop types

### React entry point (`react/index.ts`)
Hooks:
- `useActiveNotifications(options)` — Fetch active (unread) notifications for a user/category
- `useUnreadCount(options)` — Get unread notification count (with configurable limit)
- `useArchiveNotification(options)` — Archive (dismiss) a single notification
- `useArchiveAllNotifications(options)` — Archive all active notifications
- `useNotificationHistory(options)` — Fetch archived notification history

Components:
- `NotificationList` — Renders active notifications with click and clear-all handlers
- `NotificationHistoryList` — Renders archived notification history
- `NotificationUnreadBadge` — Badge showing unread count
- `NotificationEmptyState` — Empty state display

### Server entry point (`server/index.ts`)
Cloud Function helpers:
- `createNotificationHelper(config)` — Creates a helper object for writing notifications from Cloud Functions. Handles dedup, actor aggregation, and count capping.
- `processBatchHelper(config)` — Processes the pending notification queue.
- `archiveNotificationHelper(config)` / `archiveAllNotificationsHelper(config)` — Server-side archival operations.

Server types: `ServerFirestore`, `ServerCollectionRef`, `ServerQuery`, `CreateNotificationInput`, `NotificationHelper`, etc.

## Architecture
1. **Active collection** — Contains unread notifications. Existence = unread (no `isRead` flag).
2. **History collection** — Contains archived notifications with archival audit trail.
3. **Pending collection** — Queue for batch-processed notifications (for high-volume types).
4. **Dedup** — Same `dedupKey` updates the existing notification (increments count, updates actors) rather than creating duplicates.
5. **Categories** — 'user' (personal, requires targetUserId) vs 'admin' (shared, all admins see everything).

## Key Design Decisions
- No `isRead` boolean — the two-tier architecture (active vs history) inherently tracks read state.
- Dedup aggregation means "User A, User B, and 3 others liked your post" is a single notification doc.
- Actor arrays are capped (default 5) to prevent unbounded document growth.
- Config-driven: consuming apps define their own notification types, categories, and message patterns via `NotificationSystemConfig`.
- Main is server-safe types only; React runtime surface lives on `/react`; Cloud Function helpers live on `/server`.

## Files
```
src/
  index.ts, types.ts
  react/
    index.ts
    hooks/
      index.ts
      useActiveNotifications.ts, useUnreadCount.ts
      useArchiveNotification.ts, useArchiveAllNotifications.ts
      useNotificationHistory.ts
    components/
      index.ts
      NotificationList.tsx, NotificationHistoryList.tsx
      NotificationUnreadBadge.tsx, NotificationEmptyState.tsx
      relative-time.ts
  server/
    index.ts, types.ts
    createNotificationHelper.ts, processBatchHelper.ts
    archiveNotificationHelper.ts
  styles/
    notifications.css
```
