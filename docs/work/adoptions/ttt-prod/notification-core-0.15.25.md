# Adopt @ttt-productions/notification-core 0.15.25

**What:** The active notification list is a live window with Show more up to an app-set ceiling, replacing the 30-second poll and the Previous / Next pager.
**Severity:** medium

**Outdated design.** In this release the archive hooks refresh their keys by calling TanStack themselves. The agreed design has one owner for every refresh, in query-core, and a later notification-core release moves these hooks onto it. Take the install and the live list from this file as written.

- **Package and version:** `@ttt-productions/notification-core` 0.15.25.
- **Release:** `./scripts/release-multiple.sh beacon-core firebase-helpers monitoring-core notification-core query-core repo-guards q-core patch`. Adopt it with
  `query-core-0.14.37.md`, the same release.
- **What changed:**
  - `useActiveNotifications` listens to the category's active collection (query-core's
    `useFirestoreCollection` with `subscribe: true`), newest first by `updatedAt`, limited to the
    cards shown plus one look-ahead card. A new card appears at the top, an archived card leaves
    every mounted list, and the next older card slides in, with no re-read. It returns `data` (the
    rows on screen), `sourceState`, `retryState`, `refetch` (re-opens the listener),
    `showMore`, `isShowingMore`, `canShowMore`, and `hasOlderBeyondCeiling`; the paginated
    fields (`page`, `hasNextPage`, `hasPrevPage`, `nextPage`, `prevPage`, `setPage`, `isFetching`)
    are gone.
  - `UseActiveNotificationsOptions` drops `pageSize`, `refetchInterval`, and `staleTime`, and
    requires `step` (cards per Show more, and the first window) and `ceiling` (the most cards the
    window holds).
  - `NotificationList` drops its `refetchInterval` and `staleTime` props and requires `step`,
    `ceiling`, and `ceilingText`. Its Previous / Next pager is replaced by a Show more button
    (pending while the wider window loads) and, at the ceiling with older cards beyond it,
    `ceilingText` in its place. Its row focus handling, pending archives, Clear All, read states,
    and `onRenderedRowsChange` (now the window's rows, never the look-ahead card) are unchanged.
  - A list mounted over rows left in the query cache, with no other mount keeping it live, shows
    its loading state until the listener's first server answer.
  - `useArchiveNotification` and `useArchiveAllNotifications` no longer refresh the active list
    (`['notifications', 'active', category, userId]`); they still refresh the history list and the
    unread count, or the keys the app passes as `invalidateKeys`.
  - Every mounted list of one category and member shares one window, held in the query cache
    under `['notifications', 'active-window', category, userId]`, and one listener (query-core's
    shared live collection read): a list mounted while another mount keeps it live shows its rows
    at once.
- **What the app must change:**
  - Every `NotificationList` render: remove `refetchInterval` and `staleTime`; pass `step`,
    `ceiling`, and `ceilingText`. ttt-prod chooses the step and ceiling values and declares them
    as named constants in `ttt-core`; the ceiling line's wording is ttt-prod's copy (Q-Sports'
    is "Archive some notifications to see older ones.").
  - Every direct `useActiveNotifications` call: remove `pageSize`, `refetchInterval`, and
    `staleTime`; pass `step` and `ceiling`; replace any use of the paginated fields with the
    window fields above.
  - Anything in ttt-prod that relied on an archive refreshing the active list key, or that passes
    `invalidateKeys` including it, drops that: the listener owns the list.
  - A surface that should be current the moment it opens (a tray) can keep the list live while
    closed by mounting `useActiveNotifications` with the same step and ceiling where it stays
    mounted; whether ttt-prod does that is ttt-prod's decision.
  - The active list is now a live subscription: if ttt-prod keeps a reviewed list of its live
    Firestore subscriptions (a guard config), the list gains its entry there.
- **Done when:** the lockfiles name `@ttt-productions/notification-core` 0.15.25 or later, every
  `NotificationList` and `useActiveNotifications` call passes `step` and `ceiling` (and the list
  `ceilingText`) and none passes `pageSize`, `refetchInterval`, or `staleTime`, the typechecks and
  ttt-prod's Normal Test Flow are green, and an archived card leaves an open list with no reload.
