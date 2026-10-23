# Adopt @ttt-productions/chat-schemas 0.10.10

**What:** The internal operation-id bound admits every id the schemas allow.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (follow-up batch found during adoption)

- **Package and version:** `@ttt-productions/chat-schemas` 0.10.10.
- **Release:** `./scripts/release-multiple.sh query-core chat-schemas ttt-core chat-core chat-react patch`.
- **What changed:** `CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH` is derived from a lane label (`CHAT_INTERNAL_OPERATION_LABEL_MAX_LENGTH`, new), a room target, and an account id, so an operation id naming the longest room and account is admitted.
- **What the app must change:** Install `@ttt-productions/chat-schemas@latest` wherever it is declared; nothing else changes.
- **Done when:** The lockfiles name `@ttt-productions/chat-schemas` 0.10.10 or later and the gate is green.
