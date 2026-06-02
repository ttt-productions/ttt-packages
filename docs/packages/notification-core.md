# @ttt-productions/notification-core

Generic active-to-history notification package. Two-tier model: active docs remain
in the active collection until archived; personal unread state is tracked with
`seenAt`, while shared admin notification indicators stay existence-based.

## Owns

- Notification document/state types and the per-app `NotificationSystemConfig`
- Dedup/batch processing helpers that preserve the per-audience dedup scope
- React provider/hooks/components
- Server helpers (create/archive/batch) where applicable

## Deduplication contract

Deduplication is scoped by audience:

- Personal/user categories: `category + targetUserId + dedupKey`.
- Shared/admin categories: `category + dedupKey`, with `targetUserId: null`.

Batch grouping and active lookups must preserve this scope. Multi-user fan-out
must create one active stream per personal recipient, never one shared personal
doc for several recipients.

## Identity contract

Actor identity is stored **id-only**. Persisted docs keep `latestActorIds` /
`actorId` (capped) and never store display names; the consuming app resolves
names at read time (e.g. from `publicUsers`), so names cannot drift in the
stored doc. The package does not own a name resolver.

## Boundary

This package stays generic and does not import `ttt-core`. App-specific
categories, type configs, dedup-key/title/message patterns, routes, and copy are
supplied through `NotificationSystemConfig`.

## Entry points

The root is server-safe. React UI lives behind `./react`.

- `.` — types and the config contract (server-safe).
- `./react` — provider, hooks, and components.
- `./server` — create/archive/batch server helpers.
- `./styles` — notification CSS.
