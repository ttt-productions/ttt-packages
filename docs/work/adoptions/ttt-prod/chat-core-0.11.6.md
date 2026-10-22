# Adopt @ttt-productions/chat-core 0.11.6

**What:** BREAKING: the admin delete handlers are removed.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/chat-core` 0.11.6.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** BREAKING: `ModerationHandlers` loses `onDeleteMessage` and `onDeleteThread`; chat moderation handlers are member reports only (RULE-STD-FRONTEND-111).
- **What the app must change:** Install `@ttt-productions/chat-core@latest` and drop any `onDeleteMessage` / `onDeleteThread` handler; an admin delete stays reachable through the app's own admin-actions affordance.
- **Done when:** The lockfiles name `@ttt-productions/chat-core` 0.11.6 or later, no delete handler is passed to chat, and the gate is green.
