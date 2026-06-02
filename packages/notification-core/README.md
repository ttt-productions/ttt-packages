# @ttt-productions/notification-core

Generic notification system for TTT Productions apps — a two-tier
**active → history** model with dedup, batch processing, and themed React UI.

## Entrypoints

- `@ttt-productions/notification-core` — root-exported shared types.
- `@ttt-productions/notification-core/react` — React hooks/components.
- `@ttt-productions/notification-core/server` — backend helper utilities.

Backend/Functions code should avoid the `/react` subpath.

## Model

A two-tier **active → history** model. There is **no `isRead` flag**; instead,
active docs carry a `seenAt` field (`0` = unseen). Opening the tray marks items
seen (the consuming app stamps `seenAt` via the `markSeenHelper`), which clears
the unread badge **without** archiving — so "seen" and "dismissed" are distinct
states. Archiving is the explicit dismiss: it moves a notification from the
active collection to history (carrying an `ArchivalInfo` audit trail, and an
app-supplied `expireAt` on the history doc to back native TTL). History docs
extend the active shape with `expireAt`.

Duplicate triggers for the same `dedupKey` increment a single active doc's
`count`, append the actor, and reset `seenAt` to `0` so new activity re-lights
the badge.

**Notifications are Cloud-Functions-only — clients never write notification
docs.** The archive React hooks (`useArchiveNotification` /
`useArchiveAllNotifications`) perform **no Firestore writes**; they take an
app-supplied `archiveFn` / `archiveAllFn` adapter wired to the app's callable
(e.g. `httpsCallable(functions, 'archiveNotification')`) and invalidate the
read keys on success. Server helpers (`archiveNotificationHelper` /
`archiveAllNotificationsHelper`) verify ownership before the move (personal:
`targetUserId === callerUid`; shared: caller must be admin).

### Identity is id-only

Shared notification docs persist actor **ids only** — `NotificationDoc`
exposes `latestActorIds`, and `PendingNotification` exposes `actorId`. There are
**no persisted display names** (no `latestActorNames` / `actorName`); names are
resolved at read time by the consuming app (e.g. from `publicUsers`) so they
never drift in the stored doc.

## Usage

```tsx
import { useActiveNotifications } from '@ttt-productions/notification-core/react';

const { data: notifications, isLoading } = useActiveNotifications({
  config: TTT_NOTIFICATION_CONFIG,
  userId: currentUser.uid,
  category: 'user',
});
```

Backend create/queue (id-only — pass `actorId`, never a name):

```ts
import { createNotificationHelper } from '@ttt-productions/notification-core/server';

const notifier = createNotificationHelper(db, TTT_NOTIFICATION_CONFIG);
await notifier.send({ type: 'content_report', actorId, metadata: { itemId } });
```
