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

### ui-core: a stable hook class on `Button` for app-side press styling

- **Packages:** `ui-core`.
- **What changes and why:** Q-Sports' design gives every button an instant press (`transform: scale`
  on `:active`, `q-sports-league/docs/design/ui-system.md` § Motion). ui-core's
  `Button` renders only Tailwind utilities, so the one way an app can target it is by matching its
  internal utility string (`.inline-flex.justify-center.whitespace-nowrap`) — which re-styles a
  ui-core component through its private classes (FRONTEND-006), silently breaks when ui-core changes
  that string, also catches `TabsTrigger`, and blinds the app's class-system guard to those three
  utility names. `Button` gains a stable hook class (or `data-slot`) the way theme-core's hook
  classes (`.card-border`, `.elevation-raised`) give apps a named target, so an app styles every
  button's press from its own stylesheet.
- **Skipped in Q-Sports:** Unit 1.5 — the button press rule in `src/app/styles/components.css`
  (removed until this ships).
- **How Q-Sports adopts:** one `:active` rule in `components.css` keyed on the hook class, reading
  the motion tokens; covered by the kill switch.

### theme-core: a generic device-preference store over the guarded storage

- **Packages:** `theme-core` (`./react`).
- **What changes and why:** theme-core's motion store and viewer-settings sync already own guarded
  `localStorage` access (reads fall back to nothing-saved, a throwing write is held in memory for the
  page) and same-tab + cross-tab sync, in the internal `src/react/local-storage.ts`. Q-Sports needs
  the same device-local mechanism for its other per-device choices — the admin sidebar's collapsed
  state and each stats table's saved View state — and an app-side copy of theme-core's internal
  helper is a fork of a shared mechanism (ENG-003). ttt-prod's app-local stores (`text-size.tsx`,
  the companion stores) are the same shape. theme-core exports one generic store factory — an
  app-supplied storage key, change event, and parse/serialize — built on the same guarded storage
  and sync its motion store uses, so every device preference in either app runs on one mechanism.
- **Skipped in Q-Sports:** Unit 1.5 — the admin sidebar's collapsed state and the stats table's
  saved View state, remembered per device and keyed `{tableType}:{sportKey}` (the work item in
  `q-sports-league/docs/migration-2.0/ui-system/UI_SYSTEM.md`), are component state only until this
  ships; the View state's merge logic is built and tested.
- **How Q-Sports adopts:** `q-core`'s `constants/storage-keys.ts` gains the sidebar key and the
  View-state key builder (typed by `COLUMN_CATALOG_KEYS` and `SportKey`) with their change events;
  the sidebar's collapsed state and the stats table's View state each mount one store from the
  factory with them; the persistence tests are written then.

### theme-core: `MOBILE_BREAKPOINT`'s comment is off by one

- **Packages:** `theme-core`.
- **What changes and why:** `src/breakpoints.ts` documents `MOBILE_BREAKPOINT = 768` as the width
  "at and below which the UI is considered mobile", but Tailwind's `md:` starts at 768 and both apps
  query `max-width: ${MOBILE_BREAKPOINT - 1}px` — mobile is below 768. The comment says what the
  constant means: the first non-mobile width, paired with `md:`.
- **Skipped in Q-Sports:** nothing — Q-Sports' View menu already queries `MOBILE_BREAKPOINT - 1`.
- **How Q-Sports adopts:** nothing to adopt; the entry is deleted once published.

### theme-core: a server-only install that pulls in no React

- **Packages:** `theme-core`.
- **What changes and why:** theme-core's root is server-safe, but the package declares `next-themes`
  as a regular dependency, and `next-themes` declares `react` and `react-dom` as required peers — so
  installing theme-core anywhere installs React. Q-Sports' Cloud Functions now need the root's
  `THEME_NAMES`: the settings callable validates the saved theme through `q-core`'s
  `UpdateAccountSettingsInputSchema`, and `UserPrivateDataSchema` types it, both `z.enum(THEME_NAMES)`
  as this package's docs direct. `q-core` is inlined into the Functions bundle, which keeps
  theme-core external, so `functions/` must install theme-core — and its server-clean check
  (`functions/scripts/check-server-clean.mjs`) forbids React in the Functions lockfile, which is why
  theme-core is on its forbidden list today. ARCH-202 names the rule: a client-only dependency is
  declared so that a server-only install never force-installs React. theme-core makes `next-themes`
  (only `./react` uses it) an optional peer dependency, or otherwise guarantees that installing the
  package pulls in no React, and its boundary test proves the root imports nothing from it.
- **Skipped in Q-Sports:** nothing in code — Unit 2 imports `THEME_NAMES` from theme-core's published
  root in `packages/q-core/src/doc-schemas/user-profile.ts` (`themeNameSchema`, used by
  `UserPrivateDataSchema` and `packages/q-core/src/schemas/account-settings.ts`). What waits is the
  install: until this ships the Functions bundle cannot resolve theme-core (the build fails naming a
  package missing from `functions/package.json`), and `packages/q-core/package.json` does not yet
  declare the dependency, because a `file:` install of `q-core` into `functions/` would pull React in
  with it.
- **How Q-Sports adopts:** add `@ttt-productions/theme-core` to `packages/q-core/package.json`'s
  dependencies, install `@ttt-productions/theme-core@latest` in `functions/` (and `next-themes` at the
  app root if it became a peer), and remove `@ttt-productions/theme-core` from
  `FORBIDDEN_SERVER_PACKAGES` in `functions/scripts/check-server-clean.mjs`, whose test keeps proving
  React stays out.

### query-core: a retry that re-opens a failed subscription

- **Packages:** `query-core` (`./react`).
- **What changes and why:** in subscribe mode, `useFirestoreDoc` and `useFirestoreCollection` keep a
  listener error in the hook's own state once the resubscribe ladder is spent (or at once, for any
  error other than `permission-denied`), and only a change of the subscription's identity — its key
  or path — clears it. The result's `refetch()` runs the one-shot read, but the merged result stays
  in error because the listener error still wins, so an app has no way to offer a retry that
  actually re-opens a subscribed read. Q-Sports' read-failure recipe (`LoadErrorState`,
  `q-sports-league/docs/design/ui-system.md` § The recipes) is a retry that re-opens the read and
  shows its pending state, and FRONTEND-007 requires a visible way forward. The subscribed hooks gain
  one: `refetch()` in subscribe mode (or a named `resubscribe` member) clears the listener error and
  restarts the listener, and the result reports the restart as fetching until the first snapshot or
  the next error.
- **Skipped in Q-Sports:** Unit 2 — the landing page's today's games
  (`q-sports-league/src/components/landing/todays-games-section.tsx`): a failed subscription renders
  `LoadErrorState` with no retry, asking for a refresh. Unit 2 — the team and game pages' subscribed
  reads: the game (`useSportGame`, `q-sports-league/src/hooks/use-sport-game.ts`), the team's roster
  (`useTeamMemberships`, `src/hooks/use-team-memberships.ts`), and a live game's newest plays
  (`usePlayByPlay`, `src/hooks/use-play-by-play.ts`) return no `retry` for a listener error, so the
  game page, the team page's Roster tab, and the play-by-play render `LoadErrorState` asking for a
  refresh. Unit 2 — the league page's games
  (`useLeagueGames`, `q-sports-league/src/hooks/use-league-data.ts`): the featured week
  (`src/components/leagues/league-week-strip.tsx`) and the Schedule tab
  (`src/components/leagues/league-schedule.tsx`) render `LoadErrorState` with no retry, asking for a
  refresh, and the hook returns no `retry`. Unit 2 — the profile page's own-profile read
  (`useUserProfile`, `q-sports-league/src/hooks/use-user-profile.ts`): the viewer's own profile is
  `useCurrentUser`'s subscribed read, so a listener error renders `LoadErrorState` asking for a
  refresh, and the hook returns `retry: undefined` for it.
- **How Q-Sports adopts:** `useTodaysGames` (`src/hooks/use-landing-page-data.ts`) returns `retry` and
  `isRetrying` over the new member, and today's games passes them to its `LoadErrorState`;
  `useLeagueGames` returns the same pair, and the league page's week strip and Schedule tab pass them
  to theirs, with `src/__tests__/unit/league-page-reads.test.ts`'s "offers no retry" case becoming a
  retry that re-opens the read; every
  other subscribed hook's `retry` moves onto the same member, each with a hook test that a retry
  after a listener error re-opens the read. `useCurrentUser` (`src/hooks/use-current-user.ts`)
  exposes the member, and `useUserProfile` returns it as the own profile's `retry` / `isRetrying`,
  with `src/__tests__/unit/use-user-profile.test.ts`'s "reports a failed listener with no retry" case
  and `src/__tests__/components/user-profile-screen.test.tsx`'s "asks for a page refresh" case becoming
  a retry that re-opens it. `useSportGame`, `useTeamMemberships`, and `usePlayByPlay` return `retry`
  and `isRetrying` over the new member (the play-by-play's for its live window), the game page, the
  team page's Roster tab, and `PlayByPlay` pass them to their `LoadErrorState`, and
  `src/__tests__/unit/team-and-game-reads.test.ts` and `play-by-play.test.ts` gain a retry that
  re-opens each read.

### query-core: `useFirestoreLiveInfinite` loses documents as its live window slides

- **Packages:** `query-core` (`./react`).
- **What changes and why:** `useFirestoreLiveInfinite` (`src/react/firestore/use-firestore-live-infinite.ts`)
  merges a subscribed newest window, `orderBy(field, 'desc')` with `limit(pageSize)`, with older
  pages read `startAfter` the window's oldest document. Three defects:
  - The older pages' first cursor is `windowState.oldestDoc` at the moment the window is first
    ready, and it is never re-anchored. When a new document arrives, the window slides forward and
    drops its oldest document, which is then in neither read, so the merged list loses one document
    per arrival for as long as the page is open.
  - The first older page is fetched as soon as the window is ready (`enabled: enabled &&
    windowState.ready`), not when the viewer asks for earlier items.
  - The `onSnapshot` listener has no error callback and the result no error member, so a denied or
    failed listener leaves `isInitialLoading` true forever with nothing reported; the whole merged
    list is also re-sorted on every snapshot.
  The fix anchors both reads at one fixed boundary (the live read takes everything after it, the
  older pages everything up to it, so neither slides), fetches the first older page only on request,
  and surfaces the listener's and the older pages' errors. ttt-prod's chat (chat-react's
  `useChatMessages`, and the admin-support chat through it) consumes the hook and inherits all three.
- **Skipped in Q-Sports:** nothing is missing. Q-Sports' one live-plus-older read, the play-by-play
  (`q-sports-league/src/hooks/use-play-by-play.ts`), does not use the hook: a game's stat events carry
  a dense `sequence`, so it anchors a subscribed `useFirestoreCollection` and a `useFirestoreInfinite`
  at one fixed sequence itself — the reference shape for the fix.
- **How Q-Sports adopts:** once the hook takes a fixed anchor and reports its errors, `usePlayByPlay`
  moves its live window and older pages onto it and keeps only the void folding and the
  completed-game record read, with `src/__tests__/unit/play-by-play.test.ts`'s anchor, no-gap, and
  no-re-sort cases kept against it.

### firebase-helpers: Firestore's `in`-filter limit, declared once beside `chunk`

- **Packages:** `firebase-helpers` (root).
- **What changes and why:** Firestore accepts at most thirty values in one `in` filter. The
  server-safe root already exports `chunk`, which every chunked `in` read splits by, but not the
  limit it splits at, so each consumer declares the number itself. Q-Sports declares it twice, in two
  roots that cannot share an app-local constant (ARCH-005, ENG-002): `FIRESTORE_IN_FILTER_LIMIT` in
  `q-sports-league/src/hooks/use-teams-for-user.ts` and `IN_FILTER_CHUNK_SIZE` in
  `q-sports-league/functions/src/migration-console/actions/cleanupOrphanGhostPublicUsers.ts`. ttt-prod
  repeats it as well (`IN_BATCH_SIZE` in `functions/src/notifications/fanout/selectors/userFollowersMany.ts`,
  a bare `30` in `src/hooks/use-like-post.tsx` and `functions/src/safety/getSafetyCaseConsole.ts`), and
  query-core's batch loader keeps its own unexported `FIRESTORE_IN_LIMIT`. It is a Firestore platform
  limit, not Q-Sports data, so it belongs beside `chunk` rather than in `q-core`: the root exports one
  named constant (`FIRESTORE_IN_FILTER_LIMIT`), documented in `docs/packages/firebase-helpers.md`.
- **Skipped in Q-Sports:** Unit 2 — `src/hooks/use-teams-for-user.ts` keeps its own
  `FIRESTORE_IN_FILTER_LIMIT` (exported, and read by `src/__tests__/unit/use-teams-for-user.test.tsx`'s
  chunk-boundary cases); the migration console keeps `IN_FILTER_CHUNK_SIZE`.
- **How Q-Sports adopts:** both sites import the constant from `@ttt-productions/firebase-helpers` and
  delete their own; `use-teams-for-user.test.tsx` imports it from the package; the migration console's
  cleanup test does the same wherever it names the chunk size.

### file-input: `MediaInput`'s own buttons carry `type="button"`

- **Packages:** `file-input` (`./react`).
- **What changes and why:** `MediaInput` renders its single-action trigger, the Info toggle, and the
  clear button as ui-core `Button`s with no `type` (`src/react/components/media-input.tsx`), and a
  `<button>` with no `type` is a submit button. Inside a `<form>`, a click on any of them submits the
  form — picking a file, reading the info, or clearing the choice sends whatever the form sends
  (only the multi-action trigger escapes, because Radix's `DropdownMenuTrigger` sets its own type).
  Every button `MediaInput` renders sets `type="button"`, as its cancel button already does, with a
  test rendering it inside a form and asserting no submit. ttt-prod meets the same defect:
  `src/components/audition-board/create-audition-entry-dialog.tsx` renders
  `DeferredUploadFormShell` inside a `<form>` whose submit starts the upload.
- **Built, not yet published:** every `Button` file-input renders now states its type (MediaInput's
  trigger, Info, Clear, and cancel; FileInput's clear; the crop, capture, and record dialogs), proved
  by `__tests__/media-input-form.test.tsx` and held by `__tests__/button-type-guard.test.ts`. It ships
  with the next file-input publish; this entry is deleted once that is installed in Q-Sports.
- **Skipped in Q-Sports:** nothing is missing. Unit 3's two create dialogs render their picture field
  outside the `<form>` (`src/components/admin/leagues/create-league-dialog.tsx`,
  `src/components/admin/game-location-dialog.tsx`), each Create button reaching its form through the
  `form` attribute, and a comment in each names this reason.
- **How Q-Sports adopts:** nothing has to move. The comment in each dialog is rewritten to the layout
  reason alone, or the field moves back inside its form if the layout is better there; the dialogs'
  "none of its buttons submits" tests stay.
