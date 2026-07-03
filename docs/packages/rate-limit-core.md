# @ttt-productions/rate-limit-core

Generic server-side rate-limit infrastructure.

## Owns

- Upstash Redis client factory
- Ratelimit factory helpers
- Generic rate-limit error-message helper with app copy injected

## Contract shape

Single entry point (`.`), server-safe.

- `createRedisClientFactory({ credentials, disabledWhen?, logger? }) → { get(): Redis | null, __reset() }` — lazy singleton; returns `null` when disabled (e.g. emulator) or credentials missing. Callers must treat `null` as "limiting unavailable" with an explicit fail-open/closed decision.
- `createRateLimiterFactory({ getRedis, analytics?, onDegraded? }) → { getRateLimiter(config), checkRateLimit(key, config) }` — memoized per-config sliding-window limiters; `checkRateLimit` resolves `{ allowed: true } | { allowed: false, reset }` (reset = epoch ms).

## Failure posture (decided 2026-07-03): FAIL OPEN + ALERT LOUDLY

`checkRateLimit` degrades to "allow, but observed" in BOTH failure modes — the alternative (fail closed) would let an Upstash lapse take down every write callable, worse than being briefly unthrottled at launch scale. The consuming app decides the alerting behavior by injecting an `onDegraded(info)` hook (this package stays provider-agnostic — no Sentry import here):

- **Redis unavailable** (null: missing credentials or the disable hook) → the FIRST `checkRateLimit` call reports `{ reason: 'unavailable', prefix }` (at most once per factory instance) and allows. The app wires `onDegraded` to `captureMessage` in prod (so an unconfigured deploy pages within minutes of traffic) and a warn in the emulator (where Redis is deliberately disabled via `disabledWhen`).
- **Runtime `limit()` rejection** (e.g. Upstash outage) → reports `{ reason: 'limit-error', prefix, error }` per failed call and allows.

The `onDegraded` hook is invoked inside the fail-open path and its throws are swallowed — it can never break request handling.
- `RateLimitConfig` = `{ prefix, maxRequests, window }` (window strings like `"1 h"`, `"1 m"`).
- `getRateLimitErrorMessage({ reset, context?, copy? }) → string` — relative-time message; all copy injectable.

## Boundary

TTT wrappers own feature limit maps, app-specific copy, secret names, and callable-specific behavior. This package should not know about launch policy, collection names, or user-facing TTT text.
