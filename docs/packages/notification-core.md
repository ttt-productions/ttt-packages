# @ttt-productions/notification-core

Generic active-to-history notification package. Two-tier model: active docs remain
in the active collection until archived; personal unread state is tracked with
`seenAt`. A shared category's indicator is existence-based unless the category declares
`sharedSeenState`, in which case its members share one `seenAt` and the unread count
counts the cards no member has seen.

## Owns

- Notification document/state types and the per-app `NotificationSystemConfig`
- Dedup/batch processing helpers that preserve the per-audience dedup scope
- React hooks and components (no context provider — hooks take `NotificationSystemConfig` as a plain prop and consume `query-core`'s `FirestoreProvider` directly)
- Active/history list headers accept app-supplied title content. The active
  list places the title left and Clear All right; history is title-only and
  read-only. Clear All shows ui-core's pending spinner for the full pending
  interval; a text-only loading swap is never the async affordance. With nothing to
  clear it is `aria-disabled` and inert, never natively disabled, so a Clear All that
  empties the list keeps focus.
- **Labels.** The words the lists show of their own — Clear All, its pending text, the
  incomplete-clear notice, and the loading spinner's label — come from the optional `labels`
  prop (`NotificationListLabels`: `clearAll`, `clearing`, `clearIncomplete`, `loading`; the
  history list takes `loading` only). Each key omitted or passed as `undefined` keeps its English
  default.
- **Rows.** A row is inert — no pointer cursor, no click — and every affordance is a control
  the app renders in its `renderRowAction` slot, which may shrink beside the row's copy (up to
  half the row) so long content clips inside it. A row's hover tint moves on theme-core's motion
  tokens. A row's type icon is the type's `icon` text, or a bell drawn in `currentColor` (styled
  through `.ntf-item-icon`), and is hidden from assistive tech. The lists render no utility
  class of their own; the pager carries `ntf-list-footer` beside ui-core's built-in classes.
- **Focus when a row leaves.** When the row that holds focus leaves the active list (an archive
  the read has caught up with), focus moves to the first control in the action slot of the row
  that followed it, or — with no such row — to the list itself (`role="group"`, named by the
  title, `tabIndex={-1}`). Focus that had already moved elsewhere is left alone.
- **Cache keys.** Every hook, and both lists and the badge, take an optional `queryKeys`
  (`NotificationQueryKeys`: `active`, `history`, `unreadCount`, each `(category, userId) => key`)
  so an app names the reads from its own key scope. The lists read beneath their key with the
  page size under it; an archive and an archive-all refresh all three. Omitted, the keys are
  `['notifications', 'active' | 'history' | 'unread-count', category, userId]`.
- **Single-row archive.** The app's `archiveFn` (`NotificationArchiveFn`) receives the
  row exactly as the list rendered it (so the app sends what it observed — e.g. the
  row's activity generation) and resolves `{ archived: boolean }`, rejecting on
  failure. The row's `actions.archive()` resolves that same answer, so the app can say why
  a row stayed. A row's `isArchivePending` stays true after `{ archived: true }` until the
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
- **Unread count.** `useUnreadCount` returns the query's own state (`isLoading`, `isError`,
  `error`, …) beside `count`, `hasMore`, and `hasAnswer`. `count` reads `0` until the count has
  answered, so a consumer shows it only when `hasAnswer` is true (a failed refresh keeps the
  last answer). It is a server-side `count()`: a personal category counts
  its recipient's unseen cards (`targetUserId == uid`, `seenAt == 0`), a shared category with
  `sharedSeenState` counts the cards no member has seen (`seenAt == 0`), and any other shared
  category counts every active card.
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
  lifecycle. `materializeMany` isolates each row: a row whose materialize throws has its failure
  recorded, and a row whose recording also fails is handed to
  `options.onUnrecordedFailure(deliveryId, recordError, { cause })` — `cause` is the materialize
  failure it was recording — (`console.error` without it) and left as it was for a later run — one row never fails the
  batch. `replay(deliveryId, { auditWrite })` resets a dead letter to `queued` (fresh attempts,
  `lastError` / `deadLetteredAt` / `expireAt` cleared to `null`) and answers `'replayed'`; a
  missing or no-longer-dead-lettered row changes nothing and answers `'missing'` /
  `'not-dead-lettered'`. `auditWrite(transaction, row)` composes the caller's audit event into
  the reset's own transaction — called only on a reset, after every read, with the row as it
  stood, and awaited — so the event commits with the reset or neither does. `expireAt` (a real Firestore `Timestamp` via the injected
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
