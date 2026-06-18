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
seen (the consuming app stamps `seenAt` via `markNotificationSeenWithGeneration`),
which clears the unread badge **without** archiving — so "seen" and "dismissed"
are distinct states. Archiving is the explicit dismiss: it moves a notification
from the active collection to history (carrying an `ArchivalInfo` audit trail,
and an app-supplied `expireAt` on the history doc to back native TTL). History
docs extend the active shape with `expireAt`.

Duplicate triggers for the same `dedupKey` increment a single active doc's
`count`, append the actor, and reset `seenAt` to `0` so new activity re-lights
the badge.

**Notifications are Cloud-Functions-only — clients never write notification
docs.** The archive React hooks (`useArchiveNotification` /
`useArchiveAllNotifications`) perform **no Firestore writes**; they take an
app-supplied `archiveFn` / `archiveAllFn` adapter wired to the app's callable
(e.g. `httpsCallable(functions, 'archiveNotification')`) and invalidate the
read keys on success. On the server, the app's callable enforces ownership
(personal: `targetUserId === callerUid`; shared: caller must be admin) and then
runs the active → history move through `archiveNotificationWithGeneration`,
which keys the history doc on a retry-stable, app-built deterministic id and
only archives when the card's observed `activityGeneration` still matches.

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

Backend creation goes through the delivery ledger (id-only — pass `actorId`,
never a name). The app writes a reliable-occurrence/delivery row via
`createDeliveryLedger` and the global materializer converges per-recipient active
cards on the deterministic `buildActiveNotificationDocId`; seen/archive run
through the observed-generation helpers (`markNotificationSeenWithGeneration` /
`archiveNotificationWithGeneration`).

```ts
import { createDeliveryLedger } from '@ttt-productions/notification-core/server';

const ledger = createDeliveryLedger(db, TTT_NOTIFICATION_CONFIG);
await ledger.enqueue([
  { deliveryId, notificationType, eventId, recipientUid, aggregationKey, strategy, payload, payloadVersion, materializationClass },
]);
```
