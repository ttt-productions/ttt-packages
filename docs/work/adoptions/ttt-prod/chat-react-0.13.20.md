# Adopt @ttt-productions/chat-react 0.13.20

**What:** Chat's sender-name slots receive the failed read's own error.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run

- **Package and version:** `@ttt-productions/chat-react` 0.13.20.
- **Release:** `./scripts/release-multiple.sh chat-core chat-react patch`.
- **What changed:** Built against chat-core 0.11.8: `renderUnresolvedName` receives a `failed` resolution with its `error`, and `renderHeldNameFailure` a failure with its `error`.
- **What the app must change:** Install `@ttt-productions/chat-react@latest` (with chat-core 0.11.8) and hand the received `error` to the app's failure seat.
- **Done when:** The lockfiles name `@ttt-productions/chat-react` 0.13.20 or later, both name failure seats classify the read's real error, and the gate is green.
