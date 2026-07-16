# @ttt-productions/notification-core

Generic active-to-history notification package. Two-tier model: active docs remain
in the active collection until archived; personal unread state is tracked with
`seenAt`, while shared admin notification indicators stay existence-based.

## Owns

- Notification document/state types and the per-app `NotificationSystemConfig`
- Dedup/batch processing helpers that preserve the per-audience dedup scope
- React hooks and components (no context provider — hooks take `NotificationSystemConfig` as a plain prop and consume `query-core`'s `FirestoreProvider` directly)
- Active/history list headers accept app-supplied title content. The active
  list places the title left and Clear All right; history is title-only and
  read-only. Active row actions receive `isArchivePending`, which remains true
  after a successful callable response until the authoritative active query
  removes that row.
- **The history (archived) read surface:** `useNotificationHistory` (paginated read of the archived-history collection resolved from the category's `historyPath`, ordered `archivedAt desc`, flattening each `archivedSnapshot` wrapper into a `NotificationHistoryItem` via a `select` mapper) and the read-only `NotificationHistoryList` component. Owner-only (user) / admin-only (admin) reads are enforced by Firestore rules; history rows are immutable (archive is one-way — no re-archive). The active read surface stays `useActiveNotifications` / `NotificationList`.
- The batch-processing server helper (`processBatchHelper`) for the pending-queue path
- **The generic delivery ledger (notification redesign):** `createDeliveryLedger(db, config)` —
  one Firestore doc per (recipient|shared, type, occurrence) that is BOTH the queue row AND the
  idempotency ledger. `enqueue` is create-if-absent (`ALREADY_EXISTS` ⇒ a per-row duplicate
  no-op, never a page failure); `materialize` is ONE transaction that reads the delivery row +
  active card, applies the aggregation strategy exactly once (`increment` / `staticRelight`,
  exported as the pure `applyAggregation`), rotates the opaque `activityGeneration`, resets
  `seenAt`, and flips the row to `materialized`; `recordTransientFailure` / `deadLetter` /
  `replay` / `materializeMany` (bounded concurrency) own the retry / dead-letter / replay
  lifecycle. `expireAt` (a real Firestore `Timestamp` via the injected
  `config.timestampFromMillis`) is set ONLY at `materialized` — a `queued` or `deadLetter` row is
  never TTL'd. The app owns the concrete collection name + the deterministic
  `deliveryId`/`eventId`/`aggregationKey` construction and passes fully-formed rows in.
- **The observed-generation seen/archive protocol:** `markNotificationSeenWithGeneration`
  (stamps `seenAt` only if the card's opaque `activityGeneration` still matches the observed one)
  and `archiveNotificationWithGeneration` (deterministic history doc id ⇒ same-`payloadHash`
  replay returns the stored result and touches nothing, different-`payloadHash` ⇒ conflict;
  first-seen archives only under the observed-generation precondition).
- A type-scoped active-doc id: `buildActiveNotificationDocId` takes an optional `notificationType`
  so two types sharing an aggregation key never collapse onto one active doc (the legacy
  non-type-scoped id is kept byte-identical when the type is omitted).

## Deduplication contract

Deduplication is scoped by audience:

- Personal/user categories: `category + targetUserId + dedupKey`.
- Shared/admin categories: `category + dedupKey`, with `targetUserId: null`.

Batch grouping and active lookups must preserve this scope. Multi-user fan-out
must create one active stream per personal recipient, never one shared personal
doc for several recipients.

## Identity contract

Actor identity is stored **id-only**. Persisted docs keep `latestActorIds` /
`actorId` (capped) and never store display names; the consuming app resolves
names at read time (e.g. from `publicUsers`), so names cannot drift in the
stored doc. The package does not own a name resolver.

## Boundary

This package stays generic and does not import `ttt-core`. App-specific
categories, type configs, dedup-key/title/message patterns, routes, and copy are
supplied through `NotificationSystemConfig`.

## Entry points

The root is server-safe. React UI lives behind `./react`.

- `.` — types and the config contract (server-safe).
- `./react` — hooks and components (no provider/context).
- `./server` — the delivery ledger, observed-generation seen/archive protocol, the `processBatchHelper` batch path, `buildActiveNotificationDocId`, and `NotificationPermissionError` (thrown on permission-denied archive attempts).
- `./styles` — notification CSS.
