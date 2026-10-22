# Adopt @ttt-productions/chat-react 0.13.18

**What:** BREAKING: the inline admin Delete controls and the `isAdmin` flag are removed.
**Severity:** high
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/chat-react` 0.13.18.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** BREAKING: `MessageActions` and `ThreadActions` render Report only; the Delete and Delete thread buttons are gone, and `ChatCoreConfig.isAdmin` and the `isAdmin` props on `MessageList`, `MessageItemDefault`, `MessageActions`, and `ThreadActions` are removed (RULE-STD-FRONTEND-111's Packages clause).
- **What the app must change:** Install `@ttt-productions/chat-react@latest`, drop `isAdmin` from the chat config and props, and offer admin message deletion through the app's admin-actions affordance.
- **Done when:** The lockfiles name `@ttt-productions/chat-react` 0.13.18 or later, nothing passes `isAdmin` to chat-react, and the gate is green.
