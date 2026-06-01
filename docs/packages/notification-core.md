# @ttt-productions/notification-core

Generic active-to-history notification package. Two-tier model: existence in the
active collection means unread (no `isRead` flag); archiving moves a doc to history.

## Owns

- Notification document/state types and the per-app `NotificationSystemConfig`
- Dedup/batch processing helpers
- React provider/hooks/components
- Server helpers (create/archive/batch) where applicable

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
