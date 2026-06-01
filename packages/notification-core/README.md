# @ttt-productions/notification-core

Generic notification system for TTT Productions apps — a two-tier
**active → history** model with dedup, batch processing, and themed React UI.

## Entrypoints

- `@ttt-productions/notification-core` — root-exported shared types.
- `@ttt-productions/notification-core/react` — React hooks/components.
- `@ttt-productions/notification-core/server` — backend helper utilities.

Backend/Functions code should avoid the `/react` subpath.

## Model

There is **no `isRead` flag** — existence in the active collection means unread.
Archiving moves a notification from the active collection to history (carrying an
`ArchivalInfo` audit trail). Duplicate triggers for the same `dedupKey`
increment a single active doc's `count` and append the actor.

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
