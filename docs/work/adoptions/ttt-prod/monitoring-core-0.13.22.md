# Adopt @ttt-productions/monitoring-core 0.13.22

**What:** the browser init no longer attaches the page's ordinary console output to error events as breadcrumbs.
**Severity:** low
**Came from:** the Q-Sports browser-monitoring ttt-packages session

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.22.
- **Release:** `./scripts/release-multiple.sh firebase-helpers monitoring-core notification-core patch`
- **What changed:** `initBrowserMonitoring` replaces the SDK's default Breadcrumbs integration with
  one whose console source is off, so `console.log`, `info`, `warn` and `debug` lines are no longer
  recorded as breadcrumbs on the events a page sends. `console.error` is still captured as an error
  event, the other default breadcrumb sources are unchanged, and breadcrumbs the app adds through
  `addBreadcrumb` are still recorded. No option or export changed.
- **What the app must change:** the install.
- **Done when:** The lockfile names `@ttt-productions/monitoring-core` 0.13.22 or later.
