# Adopt @ttt-productions/upload-ui 0.7.19

**What:** Upload tray mutations are session-bound.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/upload-ui` 0.7.19.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** The tray's clear and mark-seen mutations run on query-core's `useSessionMutation`; mark-seen sends no further batch once the session ends. `@ttt-productions/query-core` is a new optional peer, and the `@tanstack/react-query` peer floor is `>=5.90.0`.
- **What the app must change:** Install `@ttt-productions/upload-ui@latest` with query-core; nothing else changes.
- **Done when:** The lockfiles name `@ttt-productions/upload-ui` 0.7.19 or later and the gate is green.
