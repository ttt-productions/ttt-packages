# One shared server reader of the app-config document

**What:** The cached server read of `_appConfig/app` that both apps copy moves into a package; each app supplies only its document path and any check of its own.
**Severity:** low
**Came from:** The Q-Sports migration-errors conversation, on DJ's instruction to park it here.
**Trigger:** DJ pulls it in when he has the time.

## As it is today (checked in the code)

Each app has its own `functions/src/shared/app-config-snapshot.ts`, nearly line for line the same:
a module-level cache of the `_appConfig/app` document, a 10-second freshness window, one in-flight
read shared by concurrent callers, and a sequence number so an older read never overwrites a newer
one. The differences:

- Q-Sports' `getAppConfigSnapshot(maxAgeMs)` takes the window from its caller; ttt-prod's uses its
  own `APP_CONFIG_SNAPSHOT_MAX_AGE_MS`.
- ttt-prod's also reports an invalid public-documents version block (`reportInvalidVersionBlock`).
- Both answer a failed read with an empty document today; that goes in each app first
  (`q-sports-league/docs/work/waiting-to-be-implemented/app-config-read-failure-is-an-error.md`,
  `ttt-master-app/docs/work/waiting-to-be-implemented/app-config-guard-removed.md`).

## The move

The cached reader goes into a package — `firebase-helpers`' `./server` entry is the server-side
Firestore layer (RULE-STD-ARCH-206). Each app supplies its document path (its `PATH_BUILDERS`) and
any check it runs on a fresh read, and both apps' copies go. The failed read throws, as both apps'
items above decide.

## Done when

Neither app holds its own app-config snapshot reader, the package's tests prove the cache window,
the shared in-flight read, newest-read-wins, and a failed read throwing, and both apps' gates are
green.
