# @ttt-productions/monitoring-core

Generic monitoring adapter package.

## Owns

- Monitoring adapter interface
- Sentry browser and Node adapters
- Noop adapter
- Generic `captureException` and related API
- React `ErrorBoundary` on `./react`

## Capture context

`captureException(error, context)` applies the context to the capture's scope: a `tags` key holding a
flat string map becomes REAL Sentry tags (`scope.setTag`, so the values are searchable, filterable,
and alert-routable); every other key — including a `tags` value that is not a flat string map —
becomes an extra. One helper (`src/capture-context.ts`) owns that decision for both Sentry adapters.

## Boundary

App code owns initialization values, environment naming, and fallback UI. The React error boundary accepts app-owned context/fallback values.

`initMonitoring` auto-forces the Noop adapter (skipping the dynamic SDK import entirely) whenever `NEXT_PUBLIC_USE_EMULATORS`, `FUNCTIONS_EMULATOR`, `FIREBASE_EMULATOR_HUB`, or `NEXT_PUBLIC_SENTRY_ENABLED=false` is set — local dev and emulator runs never load or initialize Sentry.
