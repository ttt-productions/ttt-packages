# Adopt @ttt-productions/notification-core 0.15.26

**What:** The active notification list no longer makes TanStack Query log "No queryFn was passed" on every render.
**Severity:** low

- **Package and version:** `@ttt-productions/notification-core` 0.15.26.
- **Release:** `./scripts/release-multiple.sh firebase-helpers monitoring-core notification-core patch`
- **What changed:** `useActiveNotifications` holds the shared window size (the cache entry
  `['notifications', 'active-window', category, userId]`) as a query whose `queryFn` is TanStack's
  `skipToken`, the form TanStack takes for a value that is never fetched. A query with no `queryFn`
  made `@tanstack/react-query` log a `console.error` ("No queryFn was passed as an option…") on every
  render of the hook outside production builds, in development and in every test that mounted the
  list. The window behaves exactly as before: one window per category and member across every
  mounted list, one step at first, one step more per Show more, capped at the ceiling, back to one
  step once the entry is collected. No API changes.
- **What the app must change:** the install. If ttt-prod's tests filter or expect that console
  line, drop that.
- **Done when:** the lockfiles name `@ttt-productions/notification-core` 0.15.26 or later and no
  "No queryFn" line for `active-window` appears in ttt-prod's tests or `dev:local` console.
