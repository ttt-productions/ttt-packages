# @ttt-productions/rate-limit-core

Generic server-side rate-limit infrastructure.

## Owns

- Upstash Redis client factory
- Ratelimit factory helpers
- Generic rate-limit error-message helper with app copy injected

## Contract shape

Single entry point (`.`), server-safe.

- `createRedisClientFactory({ credentials, disabledWhen?, logger? }) → { get(): Redis | null, __reset() }` — lazy singleton; returns `null` when disabled (e.g. emulator) or credentials missing. Callers must treat `null` as "limiting unavailable" with an explicit fail-open/closed decision.
- `createRateLimiterFactory({ getRedis, analytics? }) → { getRateLimiter(config), checkRateLimit(key, config) }` — memoized per-config sliding-window limiters; `checkRateLimit` resolves `{ allowed: true } | { allowed: false, reset }` (reset = epoch ms).
- `RateLimitConfig` = `{ prefix, maxRequests, window }` (window strings like `"1 h"`, `"1 m"`).
- `getRateLimitErrorMessage({ reset, context?, copy? }) → string` — relative-time message; all copy injectable.

## Boundary

TTT wrappers own feature limit maps, app-specific copy, secret names, and callable-specific behavior. This package should not know about launch policy, collection names, or user-facing TTT text.
