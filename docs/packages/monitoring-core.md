# @ttt-productions/monitoring-core

Generic monitoring adapter package.

## Owns

- Monitoring adapter interface
- Sentry browser and Node adapters
- Noop adapter
- Generic `captureException` and related API
- React `ErrorBoundary` on `./react`

## Capture context

`captureException(error, context)` applies the context to the capture's scope. Two keys are treated
as the first-class Sentry fields call sites mean them as: a `tags` key holding a flat string map
becomes REAL tags (`scope.setTag`, so the values are searchable, filterable, and alert-routable), and
a `level` key holding a severity name becomes the capture's REAL severity (`scope.setLevel`). Every
other key — and a `tags`/`level` value that does not fit the shape, or a scope that cannot honour it —
becomes an extra, so nothing is ever dropped. One helper (`src/capture-context.ts`) owns that
decision for both Sentry adapters.

## Boundary

App code owns initialization values, environment naming, and fallback UI. The React error boundary accepts app-owned context/fallback values.

`initMonitoring` auto-forces the Noop adapter (skipping the dynamic SDK import entirely) whenever `NEXT_PUBLIC_USE_EMULATORS`, `FUNCTIONS_EMULATOR`, `FIREBASE_EMULATOR_HUB`, or `NEXT_PUBLIC_SENTRY_ENABLED=false` is set — local dev and emulator runs never load or initialize Sentry.
