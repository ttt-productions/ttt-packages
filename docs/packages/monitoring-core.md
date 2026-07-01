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

`initMonitoring` auto-forces the Noop adapter (skipping the dynamic SDK import entirely) whenever `NEXT_PUBLIC_USE_EMULATORS`, `FUNCTIONS_EMULATOR`, `FIREBASE_EMULATOR_HUB`, or `NEXT_PUBLIC_SENTRY_ENABLED=false` is set — local dev and emulator runs never load or initialize Sentry.
