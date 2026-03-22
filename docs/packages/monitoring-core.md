# @ttt-productions/monitoring-core

Adapter-based error monitoring and observability. Provides a unified API that works with Sentry (browser), Sentry Node (Cloud Functions), or a noop adapter for local dev/testing.

## Version
0.2.14

## Dependencies
Peer: @sentry/nextjs, @sentry/node.

## What It Contains

### Adapter Interface (`adapter.ts`)
`MonitoringAdapter` interface with methods: `init`, `captureException`, `captureMessage`, `setUser`, `setTag`, `withScope?`, `addBreadcrumb?`.

### Adapters (`adapters/`)
- `SentryAdapter` — Browser/Next.js Sentry integration (lazy-loaded via dynamic import)
- `SentryNodeAdapter` — Node.js/Cloud Functions Sentry integration (lazy-loaded, guards against browser usage)
- `NoopAdapter` — Silent no-op for local dev or when monitoring is disabled

### Init (`init.ts`)
- `initMonitoring(options, force?)` — Initializes the appropriate adapter based on `options.provider` ('sentry' | 'sentry-node' | 'noop'). Prevents double-init unless forced. Auto-detects browser vs Node environment.

### Public API (`api.ts`)
Thin wrappers that delegate to the current adapter:
- `captureException(error, context?)` — Report errors
- `captureMessage(message, level?)` — Report messages (fatal/error/warning/info/debug)
- `setUser(user)` — Associate user context
- `setTag(key, value)` — Add tags to events
- `withScope(fn)` — Scoped context for a block of code
- `addBreadcrumb(breadcrumb)` — Add navigation/action breadcrumbs

## Key Design Decisions
- Lazy-loads Sentry adapters via dynamic `import()` to avoid bundling Sentry in environments that don't need it.
- `sentry-node` provider silently falls back to noop if accidentally initialized in a browser context.
- Re-init is prevented by comparing serialized options; pass `force=true` to override.

## Files
```
src/
  index.ts
  types.ts, adapter.ts, init.ts, api.ts
  adapters/
    noop.ts, sentry.ts, sentry-node.ts
```
