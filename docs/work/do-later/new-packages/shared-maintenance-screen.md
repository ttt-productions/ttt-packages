# One shared maintenance screen on the page side

**What:** The page-side maintenance takeover both apps copy — who sees the maintenance screen, and the screen and notice themselves — moves into a package; each app supplies only its open pages and its wording.
**Severity:** low
**Came from:** The Q-Sports migration-errors conversation, on DJ's instruction to park it here.
**Trigger:** DJ pulls it in when he has the time.

## As it is today (checked in the code)

Each app has its own `app-config-levers.tsx` (Q-Sports `src/components/app-config/`, ttt-prod
`src/components/shared/`) with the same pieces:

- `maintenanceTakeoverApplies({ maintenanceMode, isAdmin, pathname })`: maintenance off → no
  takeover; an admin → no takeover; otherwise the takeover covers every page but the app's open ones.
  Q-Sports keeps `/admin` and the pages under it open; ttt-prod keeps `/login` and `/admin`.
- `MaintenanceScreen` and `MaintenanceNotice`, drawn from the maintenance message lever with the
  app's `DEFAULT_MAINTENANCE_MESSAGE`.
- `useOperationalLevers` and `AnnouncementBanner`, beside them.

Each app's `client-app-shell.tsx` decides the takeover from it.

## The move

The takeover rule and the screen and notice go into a React package beside query-core's
`createAppConfig`, which already supplies the levers to the page. Each app supplies its open pages
and its message, and both apps' copies go. The server side of maintenance is already one shared
mechanism in auth-core (`q-sports-league/docs/work/waiting-to-be-implemented/maintenance-is-one-shared-mechanism.md`).

## Done when

Neither app holds its own takeover rule, maintenance screen or notice; the package's tests prove an
admin and an open page are never taken over and everyone else is; both apps' gates are green.
