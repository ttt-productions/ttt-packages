# @ttt-productions/ui-core

Generic UI primitive package.

## Owns

- shadcn-style primitives and shared UI helpers
- `cn`
- Generic app-agnostic components such as relative time, end-of-list indicator, scroll-to-top button, and chunk error recovery
- Generic formatting helpers such as `formatLargeNumber`

## Boundary

Feature-specific app components stay in the consuming app. Keep main entry server-safe; React UI lives behind `./react`.
