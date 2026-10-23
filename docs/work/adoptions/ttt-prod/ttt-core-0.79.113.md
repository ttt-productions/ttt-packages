# Adopt @ttt-productions/ttt-core 0.79.113

**What:** The chat moderation actions come from chat-schemas.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (follow-up batch found during adoption)

- **Package and version:** `@ttt-productions/ttt-core` 0.79.113.
- **Release:** `./scripts/release-multiple.sh query-core chat-schemas ttt-core chat-core chat-react patch`.
- **What changed:** `AdminModerateChatMessageInputSchema` and `ChatAdminActionCommandSchema` take their `action` values from chat-schemas' `CHAT_MODERATION_ACTIONS` instead of declaring them again. The values are unchanged.
- **What the app must change:** Install `@ttt-productions/ttt-core@latest` wherever it is declared; nothing else changes.
- **Done when:** The lockfiles name `@ttt-productions/ttt-core` 0.79.113 or later and the gate is green.
