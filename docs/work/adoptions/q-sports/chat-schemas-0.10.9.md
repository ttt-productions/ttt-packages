# Adopt @ttt-productions/chat-schemas 0.10.9

**What:** The chat internal-call contract (paths, body schemas, operation ids) is declared once.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (Phase 3 package batch)

- **Package and version:** `@ttt-productions/chat-schemas` 0.10.9.
- **Release:** `./scripts/release-multiple.sh dev-standards firebase-helpers repo-guards query-core chat-schemas report-core notification-core ttt-core upload-ui chat-core chat-react patch`.
- **What changed:** New root exports: `CHAT_INTERNAL_PATHS`, `ChatInternalPath`, `isChatInternalPath`, `CHAT_MODERATION_ACTIONS`, the strict internal body schemas (channel moderate, channel context, anonymizable epochs, anonymize live / scan / rewrite / swap / delete / cleanup) with their types, `CHAT_INTERNAL_CALLS`, `ChatInternalBody`, `chatInternalOperationId`, `ChatInternalCallRequest`, `ParsedChatInternalRequest`, `parseChatInternalRequest`, and `CHAT_ARCHIVE_KEY_MAX_LENGTH`. The existing bound constants keep their root names.
- **What the app must change:** Install `@ttt-productions/chat-schemas@latest`. An app whose backend calls a chat Worker's internal endpoints switches both sides onto `CHAT_INTERNAL_PATHS`, the body schemas, `parseChatInternalRequest`, and `chatInternalOperationId`, and deletes its local path constants and operation-id map. An app with no such channel only installs.
- **Done when:** The lockfiles name `@ttt-productions/chat-schemas` 0.10.9 or later, no local copy of an internal path, body shape, or operation-id rule remains, and the gate is green.
