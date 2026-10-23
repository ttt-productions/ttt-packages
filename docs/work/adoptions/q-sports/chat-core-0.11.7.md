# Adopt @ttt-productions/chat-core 0.11.7

**What:** A resolved sender name can carry a later read failure.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (follow-up batch found during adoption)

- **Package and version:** `@ttt-productions/chat-core` 0.11.7.
- **Release:** `./scripts/release-multiple.sh query-core chat-schemas ttt-core chat-core chat-react patch`.
- **What changed:** `ChatNameResolution`'s `resolved` member gains an optional `failure: { retry }` (type `ChatNameReadFailure`, new export) for a held name whose later read failed.
- **What the app must change:** Install `@ttt-productions/chat-core@latest`. A name resolver that holds a name through a failed read returns it as `resolved` with `failure`, never as a bare name.
- **Done when:** The lockfiles name `@ttt-productions/chat-core` 0.11.7 or later, a held name's failure reaches the chat UI, and the gate is green.
