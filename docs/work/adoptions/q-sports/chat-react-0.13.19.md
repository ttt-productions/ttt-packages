# Adopt @ttt-productions/chat-react 0.13.19

**What:** Chat shows a held sender name's failure beside the name.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (follow-up batch found during adoption)

- **Package and version:** `@ttt-productions/chat-react` 0.13.19.
- **Release:** `./scripts/release-multiple.sh query-core chat-schemas ttt-core chat-core chat-react patch`.
- **What changed:** `ChatNameResolverProvider` takes an optional `renderHeldNameFailure(failure)`; `SenderName` renders a resolved name and, when it carries a failure, the app's failure seat beside it (RULE-STD-FRONTEND-206).
- **What the app must change:** Install `@ttt-productions/chat-react@latest` and pass `renderHeldNameFailure` with the app's inline read-failure seat.
- **Done when:** The lockfiles name `@ttt-productions/chat-react` 0.13.19 or later, a held name whose read failed shows the inline failure with its retry, and the gate is green.
