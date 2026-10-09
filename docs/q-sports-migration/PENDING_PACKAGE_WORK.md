# Pending package work — Q-Sports 2.0 conversion

The one list of `@ttt-productions/*` changes the Q-Sports 2.0 conversion needs and has not built yet.
It holds only remaining work: an entry is deleted once its package change is published, installed in
Q-Sports, and every Q-Sports spot it skipped has been built.

## How the list works

- **Conversion never stops at a package need.** When a piece of Q-Sports work needs a change in
  `ttt-packages`, the agent does not build that piece — never against unpublished package code, and
  never through an app-side shim. It adds an entry here and keeps converting everything else.
- **`q-core` never appears here.** It lives in the Q-Sports repo during the conversion and is changed
  directly by the unit that needs it.
- **The batch.** DJ and the orchestrator decide together when to run it — there is no fixed count;
  a batch may be three entries or nine, and a blocking entry may be cleared on its own. When a batch
  runs, Q-Sports work pauses: one agent does every entry in it in `ttt-packages` against that repo's
  `CLAUDE.md` and gate, DJ publishes and installs, agents build every skipped Q-Sports spot, the
  entries are deleted, and conversion continues.
- **ttt-prod adoption is DJ's.** When a batch publishes, DJ runs a ttt-prod conversation to adopt the
  changed packages. This list says how Q-Sports adopts, not ttt-prod.

## Entry format

Each entry is one `###` heading naming the change, then:

- **Packages:** the package folders it touches.
- **What changes and why:** the package-side change and the Q-Sports need that forced it.
- **Skipped in Q-Sports:** every spot not built because of it — unit, file or step doc, and what is
  missing there.
- **How Q-Sports adopts:** what gets built at each skipped spot once the change is installed.

## Entries

### notification-core: the React lists follow the apps' motion and class rules, take app keys, and count shared seen state

- **Packages:** `notification-core` (`./react` and its stylesheet).
- **What changes and why:** Q-Sports mounts `NotificationList` / `NotificationHistoryList` on its
  admin Dashboard (Unit 7) and meets four package-side gaps:
  - `.ntf-item` sets `cursor: pointer` on a row that does nothing when clicked, and a literal
    `transition: background-color 150ms` instead of a motion token an app's kill switch covers
    (Q-Sports FRONTEND-204);
  - `NotificationList` passes a Tailwind `mt-0` to `ListPagination` and falls back to a 🔔 emoji
    icon (an app with a semantic class system cannot restyle either);
  - the package hooks key their reads with their own `['notifications', …]` arrays, so an app cannot
    name them from its one canonical key scope (ARCH-109 in both apps) — accept an app key factory;
  - `useUnreadCount` ignores `seenAt` for shared categories, so a shared-admin badge cannot use it;
  - `NotificationRowActions.archive()` resolves `void`, so the app cannot explain an
    `archived: false` answer (new activity relit the card) — it resolves the `{ archived }` answer;
  - `NotificationList` removes an archived row that held focus without giving focus a destination
    (FRONTEND-203 in both apps) — it moves focus to the next row's control, or the list, itself.
- **Skipped in Q-Sports:** nothing is missing — Q-Sports overrides `.ntf-item-row-action` in
  `components.css`, keeps the package's keys outside its scope (documented in
  `docs/design/data-layer.md`), and runs its own unseen-count hook (`useAdminNotificationsUnseen`,
  `src/hooks/use-admin-notifications.ts`).
- **How Q-Sports adopts:** delete the CSS override, pass its key factory, and move the badge onto
  `useUnreadCount`, read `archive()`'s answer directly and drop its wrapper, and drop its own
  post-archive focus move, with the hook and component tests kept.
- **As built:** the key factory is a `queryKeys` option (`NotificationQueryKeys`: `active`,
  `history`, `unreadCount`, each `(category, userId) => key`) on every hook, both lists, and the
  badge — not a config field, so q-core's config stays app-key-free. The shared seen count is the
  category flag `sharedSeenState: true` (set on the admin category in q-core's config). The row
  slot now shrinks (`flex-shrink: 1; min-width: 0; max-width: 50%`), which is what lets the CSS
  override go. With `mt-0` gone the pager carries ui-core `ListPagination`'s built-in top margin.
  `useUnreadCount` is a polled `count()`, not a listener; its `count` reads `0` until it answers,
  so the badge shows it only when the hook's `hasAnswer` is true (see the notification-core
  follow-up entry below).

### notification-core: `replay` takes an audit hook, and one row's failure never fails a batch

- **Packages:** `notification-core` (`./server`).
- **What changes and why:**
  - `ledger.replay` opens its own transaction, so an app cannot commit its audit event with the reset
    (BACKEND-202 in both apps). Both apps therefore re-implement the reset by hand — Q-Sports'
    `functions/src/notifications/runReplayNotificationDelivery.ts` and ttt-prod's
    `functions/src/admin-dispatch-actions/adminReplayDeadLetter.ts` — and the two copies already
    differ from the package (ttt-prod deletes `expireAt` where the package writes `null`). `replay`
    gains an `auditWrite(transaction)` hook (as `archiveNotificationWithGeneration` has), called
    synchronously inside its transaction, so both apps call the package.
  - Inside `materializeMany`, a throw from `recordTransientFailure` for one row rejects the whole
    batch. Each row's failure recording is isolated so one bad row is captured and the rest proceed.
- **Skipped in Q-Sports:** nothing is missing — Unit 7's replay writes its own reset in one
  transaction with its audit event (an ARCH-203 exception named in its comment).
- **How Q-Sports adopts:** `runReplayNotificationDelivery.ts` calls `ledger.replay` with the audit
  hook and deletes its own reset and the exception comment; its tests keep proving one transaction,
  one audit event, and no write on an audit failure.
- **As built:** `replay(deliveryId, { auditWrite })` answers `'replayed' | 'missing' |
  'not-dead-lettered'`. `auditWrite(transaction, row)` receives the row as the transaction read it
  (for the audit's `previous` fields) and is awaited, so the async `writeAuditEventAs(…, {
  transaction })` composes; it does not parse the row against q-core's schema — the app does that
  inside the hook if it still wants the schema fault. The reset still writes `expireAt: null`.
  `materializeMany` takes `onUnrecordedFailure(deliveryId, recordError, { cause })` for the app's
  capture — `cause` is the materialize failure the ledger was recording.

### query-core: a subscribed read's listener error reaches the app's query error reporter

- **Packages:** `query-core` (`./react`).
- **What changes and why:** Q-Sports ports ttt-prod's `QueryErrorReporter` as the one capture owner
  for failed reads (FRONTEND / QUALITY-101: one capture point, no per-hook capture). It subscribes to
  the React Query cache. A subscribed read's listener error (`useFirestoreDoc` /
  `useFirestoreCollection` with `subscribe`, and `useFirestoreLiveInfinite`'s live window) is kept in
  the hook's own status and never reaches the query cache, so the reporter never sees it; the hook
  only `console.error`s it. Either write the listener's surfaced error into the query's state (so the
  cache's error event fires once per surfaced error), or add a provider-level `onListenerError`
  callback the app wires to its reporter. Either way, a listener error is captured exactly once, after
  the permission-denied ladder is spent.
- **Skipped in Q-Sports:** Unit 2 — `src/components/query-error-reporter.tsx` captures one-shot reads
  only. `src/context/app-config-context.tsx` and `src/context/stats-beacon-context.tsx` capture their
  own listener errors meanwhile; the other subscribed hooks (`useSportGame`, `useTeamMemberships`,
  `useLeagueGames`, `useTodaysGames`, `useCurrentUser`, `usePlayByPlay`) report listener failures to
  the console only.
- **How Q-Sports adopts:** wire the new member to `QueryErrorReporter`'s capture, delete the two
  contexts' own listener capture, and add a reporter test that a listener error is captured once.
- **As built:** the provider-level callback —
  `<FirestoreProvider onListenerError={(error, { hook, queryKey, path }) => …}>`
  (`FirestoreListenerErrorHandler`). With a handler the hooks no longer `console.error` the error.

### query-core: `useFirestoreLiveInfinite`'s older pages take an app cache tier

- **Packages:** `query-core` (`./react`).
- **What changes and why:** the older-pages query inside `useFirestoreLiveInfinite` takes no
  `staleTime` / `gcTime`, so an app cannot put it on its declared freshness tier (FRONTEND-103).
  Q-Sports' play-by-play uses the hook, so its older pages sit on query-core's defaults rather than
  the tier the app declares for them (a void is still folded, since it arrives in the live window).
  The hook accepts the same cache options its sibling hooks do and applies them to the older pages.
- **Skipped in Q-Sports:** Unit 2 — `src/hooks/use-play-by-play.ts` cannot pass its tier;
  the play-by-play's older pages keep query-core's default freshness.
- **How Q-Sports adopts:** `usePlayByPlay` passes its tier from `src/lib/cache-config.ts`, and the play-by-play test asserts the option reaches the hook.
- **As built:** `staleTime` and `gcTime` on `FirestoreLiveInfiniteOptions`, applied to the
  older-pages query.

### ui-core: a pending `Switch` (and `Button`) stays focusable

- **Packages:** `ui-core` (`./react`).
- **What changes and why:** `Switch` with `pending` sets the native `disabled`, which blurs the control
  the user just pressed and drops focus to `<body>` (FRONTEND-203 in Q-Sports; the same accessibility
  rule in ttt-prod, which uses the same component). A pending control stays focusable: `aria-disabled`
  plus ignoring activation while pending, with the pending indicator. Check `Button`'s `pending` for
  the same behaviour.
- **Skipped in Q-Sports:** Unit 10 — the scoring roster's Absent switch
  (`src/components/stats/scoring-roster.tsx`) loses focus on every toggle; Q-Sports' own `ChoiceGroup`
  already uses `aria-disabled` for the same reason.
- **How Q-Sports adopts:** nothing to change in the app; the Absent switch test asserts focus stays on
  the switch while pending.
- **As built:** both `Switch` and `Button` — a pending one carries `aria-disabled` and `aria-busy`,
  is never natively disabled, and cancels activation before any click handler runs. App tests
  that assert `toBeDisabled()` on a pending control now assert `aria-disabled="true"`.


### monitoring-core: the browser adapter passes through `ignoreErrors` and `transport`

- **Packages:** `monitoring-core`.
- **What changes and why:** `toSdkInitOptions` forwards only `tracesSampleRate`, `integrations`,
  `defaultIntegrations`, `beforeSend`, and `beforeSendTransaction`. Q-Sports needs its ignore list in
  the browser (only the server side has one, in `instrumentation.ts`) and an offline-capable transport
  (HARDENING § Browser monitoring configuration), without a second init (QUALITY-106).
- **Skipped in Q-Sports:** Unit 14 — `src/lib/browser-monitoring.ts` passes neither.
- **How Q-Sports adopts:** add `ignoreErrors` and `transport` to the browser policy, tested in
  `src/__tests__/unit/browser-monitoring.test.ts`.
- **As built:** `ignoreErrors` is a pass-through on `MonitoringInitOptions`. For the transport
  the browser policy sets `offlineTransport: true` (see the monitoring-core follow-up entry below),
  so it names no SDK; a raw `transport` pass-through also exists but Q-Sports does not use it.

### monitoring-core: the browser adapter builds the offline transport itself

- **Packages:** `monitoring-core`.
- **What changes and why:** a raw `transport` pass-through makes the browser policy import the
  monitoring SDK to build the offline transport, and the policy names no SDK (QUALITY-106). The
  init takes `offlineTransport: true` instead, and the browser adapter builds the SDK's
  offline-queueing transport over the SDK's own fetch transport from the SDK it loads.
- **Skipped in Q-Sports:** Unit 14 — `src/lib/browser-monitoring.ts` has no offline transport.
- **How Q-Sports adopts:** the browser policy sets `offlineTransport: true`, tested in
  `src/__tests__/unit/browser-monitoring.test.ts`.
- **As built:** `MonitoringInitOptions.offlineTransport?: boolean`. `initMonitoring` rejects it
  beside `transport` and on `sentry-node`; an SDK lacking the two transports fails the init rather
  than sending unqueued.

### query-core: `useBatchFirestoreDocs` subscribe-mode listener errors reach the reporter

- **Packages:** `query-core` (`./react`).
- **What changes and why:** `useBatchFirestoreDocs` in `subscribe` mode kept each id's listener
  error in its outcomes and reported it nowhere, so a failed shared listener was invisible to the
  one capture owner (QUALITY-107). Its errors now go to the provider's `onListenerError`, like the
  other subscribed hooks.
- **Skipped in Q-Sports:** nothing is missing — it arrives through the `onListenerError` wiring the
  listener-error entry above adopts.
- **How Q-Sports adopts:** nothing beyond that wiring; the reporter test covers a batch id's error.
- **As built:** `details.hook` is `'useBatchFirestoreDocs'`, `queryKey` is `[queryKeyPrefix, id]`,
  `path` is `collectionPath/id`. A shared listener reports once, through the consumer that opened
  it; a consumer that joins it after it failed reports nothing again. Outside a
  `FirestoreProvider` (the hook takes `db` as an option) the error goes to the console.

### ui-core: pagination, select, and menu-item controls stay focusable while unavailable

- **Packages:** `ui-core` (`./react`).
- **What changes and why:** `ListPagination` natively disabled both controls while a page loaded
  and at each edge, and a pending `SelectTrigger` or `DropdownMenuItem` disabled itself, so the
  control the user just pressed dropped focus to `<body>` (FRONTEND-203). They take the pending
  `Button`/`Switch` treatment.
- **Skipped in Q-Sports:** nothing is missing — the paged lists, pending selects, and pending menu
  items use these components as they are.
- **How Q-Sports adopts:** nothing in the app; tests that assert `toBeDisabled()` on a pagination
  edge, a busy pager, a pending select trigger, or a pending menu item assert
  `aria-disabled="true"` instead.
- **As built:** `ListPagination` controls are `type="button"` and, at an edge or while `busy`,
  `aria-disabled` and inert — never natively disabled. A pending `SelectTrigger`, and a pending
  `Button` (so one used `asChild` as a menu or popover trigger), open on no pointer press and stop
  Space, Enter, ArrowUp, ArrowDown, and a single printable character before any handler — the
  caller's `onKeyDown` included; Tab, Escape, function keys, and modified keys pass. A pending
  `DropdownMenuItem` ignores selection by pointer, Enter, or Space (an `asChild` link goes
  nowhere) and stays in the menu's focus order (no `data-disabled`).

### notification-core: Clear All keeps focus, the unread count says when it has answered, the lists' words are the app's

- **Packages:** `notification-core` (`./react` and its stylesheet).
- **What changes and why:** Clear All turned natively disabled when the list emptied under it, so
  focus dropped (FRONTEND-203); `useUnreadCount` returned `count: 0` before it had read anything,
  a default a consumer could not tell from an answer (FRONTEND-206); `NotificationList` showed
  fixed English words of its own (ARCH-201); `.ntf-badge--hidden` was dead CSS.
- **Skipped in Q-Sports:** nothing is missing — the admin notification card overrides none of this.
- **How Q-Sports adopts:** the badge reads `useUnreadCount`'s `hasAnswer` (with `isError`) and
  shows the count only when it is true; the lists receive their words through `labels` from the
  app's copy module; tests assert Clear All keeps focus as the list empties.
- **As built:** Clear All is `type="button"` and `aria-disabled` with nothing to clear, never
  natively disabled. `useUnreadCount` keeps `count` (still `0` before an answer, for ttt-prod's
  callers) and adds `hasAnswer: boolean` beside the query's own `isLoading`/`isError`/`error`.
  `labels?: Partial<NotificationListLabels>` (`clearAll`, `clearing`, `clearIncomplete`, `loading`)
  on `NotificationList`, and `labels?: { loading? }` on `NotificationHistoryList`; a key omitted or
  passed as `undefined` keeps its English default. `.ntf-badge--hidden` is deleted.
