# @ttt-productions/monitoring-core

Generic monitoring adapter package.

## Owns

- Monitoring adapter interface
- Sentry browser and Node adapters
- Noop adapter
- Generic `captureException` and related API
- React `ErrorBoundary` on `./react`

## Boundary

App code owns initialization values, environment naming, and fallback UI. The React error boundary accepts app-owned context/fallback values.
