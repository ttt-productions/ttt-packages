# @ttt-productions/notification-core

Two-tier notification system: active (unread) → history (archived). Supports deduplication, batch processing, user and admin notification categories, and themed UI components. Has both client-side React hooks/components and server-side Cloud Function helpers.

## Version
0.2.2

## Dependencies
Peer: @tanstack/react-query, @ttt-productions/query-core, @ttt-productions/ui-core, firebase, react, react-dom.

## What It Contains

### Client Entry Point (`index.ts`)

**Types (`types.ts`)**
Core data model:
- `NotificationDoc` — Active notification: type, dedupKey, category, targetUserId, title, message, count (dedup aggregation), latestActorIds/Names, targetPath, metadata, createdAt/updatedAt (epoch ms)
- `NotificationHistoryDoc` — Extends NotificationDoc with `archival: ArchivalInfo` (archivedBy, archivedAt, device)
- `PendingNotification` — Queue item for the batch processor

Configuration:
- `NotificationSystemConfig` — Full system config provided by each consuming app, containing `categories` (collection paths + audience type), `types` (dedup patterns, title/message builders, delivery mode), batch interval, pending collection path
- `NotificationCategoryConfig` — Per-category: activePath, historyPath, audienceType ('personal' | 'shared')
- `NotificationTypeConfig` — Per-type: category, delivery ('realtime' | 'queued'), dedupKeyPattern, titlePattern, messagePattern, defaultTargetPath, countCap, actorCap

**Hooks (`hooks/`)**
- `useActiveNotifications(options)` — Fetch active (unread) notifications for a user/category
- `useUnreadCount(options)` — Get unread notification count (with configurable limit)
- `useArchiveNotification(options)` — Archive (dismiss) a single notification
- `useArchiveAllNotifications(options)` — Archive all active notifications
- `useNotificationHistory(options)` — Fetch archived notification history

**Components (`components/`)**
- `NotificationList` — Renders active notifications with click and clear-all handlers
- `NotificationHistoryList` — Renders archived notification history
- `NotificationUnreadBadge` — Badge showing unread count
- `NotificationEmptyState` — Empty state display
- `relative-time.ts` — "2 hours ago" style time formatting

### Server Entry Point (`server/index.ts`)
Cloud Function helpers:
- `createNotificationHelper(config)` — Creates a helper object for writing notifications from Cloud Functions. Handles dedup (same dedupKey updates existing notification instead of creating new), actor aggregation, count capping.
- `processBatchHelper(config)` — Processes the pending notification queue (for scheduled/queued delivery mode)
- `archiveNotificationHelper(config)` / `archiveAllNotificationsHelper(config)` — Server-side archival operations

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

## Files
```
src/
  index.ts, types.ts
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
```
