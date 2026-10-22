# @ttt-productions/rate-limit-core

Generic server-side rate-limit infrastructure.

## Owns

- Upstash Redis client factory
- Ratelimit factory helpers
- Generic rate-limit error-message helper with app copy injected

## Contract shape

Single entry point (`.`), server-safe.

- `createRedisClientFactory({ credentials, disabledWhen?, logger? }) → { get(): Redis | null, __reset() }` — lazy singleton; returns `null` when the `disabledWhen` hook says so or credentials are missing. Callers must treat `null` as "limiting unavailable" with an explicit fail-open/closed decision.
- `createRateLimiterFactory({ getRedis, analytics?, onDegraded? }) → { getRateLimiter(config), checkRateLimit(key, config) }` — memoized sliding-window limiters, one per `prefix`, reused only while `maxRequests` and `window` still match: a caller that changes a bucket's capacity at runtime gets a limiter built for the new values, counting in the same Redis prefix, never the one built first. `checkRateLimit` resolves `{ allowed: true } | { allowed: false, reset }` (reset = epoch ms).
- `RateLimitConfig` = `{ prefix, maxRequests, window }` (window strings like `"1 h"`, `"1 m"`).
- `getRateLimitErrorMessage({ reset, context?, copy? }) → string` — relative-time message; all copy injectable.

## Failure posture: fail open, reported

`checkRateLimit` degrades to "allow, but reported" in both failure modes, and reports each through the injected `onDegraded(info)` hook (the package stays provider-agnostic — no monitoring import here):

- **Redis unavailable** (`getRedis` returns `null`) → the first `checkRateLimit` call reports `{ reason: 'unavailable', prefix }` (at most once per factory instance) and allows.
- **Runtime `limit()` rejection** → reports `{ reason: 'limit-error', prefix, error }` per failed call and allows.

The `onDegraded` hook is invoked inside the fail-open path and its throws are swallowed — it can never break request handling. What the hook does with a report is the consuming app's.

## Boundary

The consuming app's wrappers own feature limit maps, app-specific copy, credentials, and callable-specific behavior. This package does not know about any app's limits, collection names, or user-facing text.
