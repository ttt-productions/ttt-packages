# @ttt-productions/rate-limit-core

Generic server-side rate-limit infrastructure.

## Owns

- Upstash Redis client factory
- Ratelimit factory helpers
- Generic rate-limit error-message helper with app copy injected

## Boundary

TTT wrappers own feature limit maps, app-specific copy, secret names, and callable-specific behavior. This package should not know about launch policy, collection names, or user-facing TTT text.
