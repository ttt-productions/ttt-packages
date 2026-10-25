# Adopt @ttt-productions/monitoring-core 0.13.17

**What:** The telemetry scrubber is typed over the event it is handed, so a Sentry hook needs no cast.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (fifth package release)

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.17.
- **Release:** `./scripts/release-multiple.sh auth-core dev-standards monitoring-core repo-guards ttt-core patch`.
- **What changed:**
  - `ScrubbableEvent` has no string index signature, so an SDK's own event interface (Sentry's `ErrorEvent`, `TransactionEvent`, `Event`) satisfies it as it is.
  - `createTelemetryScrubber` returns a `TelemetryScrubber`: `<T extends ScrubbableEvent>(event: T, hint?) => T`, the same object it was handed. `BeforeSendHook` (the `initMonitoring` option type) is `<T extends ScrubbableEvent>(event: T, hint?) => T | null`. `BeforeSendHint` and `TelemetryScrubber` are exported from the root.
- **What the app must change:** Install. Every cast bridging an SDK event to `ScrubbableEvent` and back (`event as unknown as …`, `… as unknown as ReturnType<BeforeSend>`) in the app's Sentry hooks is deleted: the scrubber and `keepAllowlistedTelemetry` take the SDK's event and hand back its type. A hook declared as `BeforeSendHook` that was a non-generic `(event: ScrubbableEvent) => ScrubbableEvent` becomes generic over the event.
- **Done when:** The lockfiles name 0.13.17 or later, the app's Sentry hooks hold no cast, and typecheck is green.
