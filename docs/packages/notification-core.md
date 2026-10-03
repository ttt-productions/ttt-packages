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
  read-only. Clear All is disabled with a visible spinner for the full
  pending interval; a text-only loading swap is never the async affordance.
- **Single-row archive.** The app's `archiveFn` (`NotificationArchiveFn`) receives the
  row exactly as the list rendered it (so the app sends what it observed — e.g. the
  row's activity generation) and resolves `{ archived: boolean }`, rejecting on
  failure. A row's `isArchivePending` stays true after `{ archived: true }` until the
  authoritative active read drops the row; `{ archived: false }` (the server archived
  nothing — the card changed after it was rendered) and a rejection clear it at once.
- **Read states.** While a list's first page loads it renders ui-core's `Spinner` as
  a status region. A failed read renders the app's required `renderError` slot
  (`NotificationListErrorState`: `error`, `retry` — re-reads the displayed page —
  `retrying`, and `hasRows` when an earlier read's rows are still shown above it);
  it is never shown as the empty state. The empty state is the answer for an
  answered, empty page 1 only. Both lists page with ui-core's `ListPagination`
  (Previous / counter / Next), which stays on a failed or empty later page so the
  user can step back; Next replaces the list, and the clicked control spins while
  its page loads. All copy in these slots is the app's.
- **Rendered rows.** The active list calls `onRenderedRowsChange(rows)` with the rows on
  screen each time the displayed page's answered rows change — the rows the app marks
  seen, on any page.
- **Freshness.** `useActiveNotifications` re-reads the displayed page every
  `refetchInterval` ms (default 30s) while mounted, and takes `staleTime` (default
  30s) as a separate setting; both are list props too. Paging is query-core's
  `useFirestorePaginated` (one cache entry per page with a look-ahead, so `hasNextPage`
  is truthful).
- **The history (archived) read surface:** `useNotificationHistory` (paginated read of the archived-history collection resolved from the category's `historyPath`, ordered `archivedAt desc`, flattening each `archivedSnapshot` wrapper into a `NotificationHistoryItem` via a `select` mapper) and the read-only `NotificationHistoryList` component. Owner-only (user) / admin-only (admin) reads are enforced by Firestore rules; history rows are immutable (archive is one-way — no re-archive). The active read surface stays `useActiveNotifications` / `NotificationList`.
- The batch-processing server helper (`processBatchHelper`) for the pending-queue path
- **The generic delivery ledger (notification redesign):** `createDeliveryLedger(db, config, options)` —
  one Firestore doc per (recipient|shared, type, occurrence) that is BOTH the queue row AND the
  idempotency ledger. `enqueue` is create-if-absent (`ALREADY_EXISTS` ⇒ a per-row duplicate
  no-op, never a page failure); `materialize` is ONE transaction that reads the delivery row +
  active card, applies the aggregation strategy exactly once (`increment` / `staticRelight`,
  exported as the pure `applyAggregation`), rotates the opaque `activityGeneration`, resets
  `seenAt`, and flips the row to `materialized`; `recordTransientFailure` / `deadLetter` /
  `replay` / `materializeMany` (bounded concurrency) own the retry / dead-letter / replay
  lifecycle. `expireAt` (a real Firestore `Timestamp` via the injected
  `config.timestampFromMillis`) is set ONLY at a terminal success (`materialized` or `skipped`) —
  a `queued` or `deadLetter` row is never TTL'd. The app owns the concrete collection name + the
  deterministic `deliveryId`/`eventId`/`aggregationKey` construction and passes fully-formed rows in.
- **Recipient eligibility at materialization.** `options.isRecipientEligible(recipientUid, tx)`
  (required) is the app's answer to "may this recipient still receive a notification?". The ledger
  calls it inside the `materialize` transaction, after reading the delivery row and before any write,
  reading only through `tx`, so the answer and the card write commit together. An ineligible
  recipient gets no card: the row becomes terminal `skipped` (`skipReason: 'recipientIneligible'`,
  `skippedAt`, TTL'd) and the call answers `'skipped-ineligible-recipient'`; a re-run answers the
  same and writes nothing, and `replay` leaves it alone (it re-queues only dead letters). A row whose
  check throws is an ordinary transient failure (retried, never skipped), and one row's answer never
  affects the others in a `materializeMany` batch. A shared (recipient-less) row is never checked. A
  consumer with no eligibility rule passes `async () => true`; the package knows nothing of what
  makes a recipient ineligible.
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
