# Adopt @ttt-productions/rate-limit-core 0.8.6

**What:** The limiter takes the Redis slice Upstash Ratelimit requires.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/rate-limit-core` 0.8.6.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `getRedis` returns a `RateLimitRedis` (exported) — the slice of a client `@upstash/ratelimit` itself requires. An `@upstash/redis` client is one.
- **What the app must change:** Install. A test client is typed as `RateLimitRedis`, with no cast.
- **Done when:** The lockfiles name 0.8.6 or later.
