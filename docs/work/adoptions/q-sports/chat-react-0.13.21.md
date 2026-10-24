# Adopt @ttt-productions/chat-react 0.13.21

**What:** Exports carry real types instead of `any`.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/chat-react` 0.13.21.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:** `ChatShellProps.renderMessage` is `(m: ChatMessageV1) => ReactNode`, matching `MessageList`.
- **What the app must change:** Install. A `renderMessage` written against a looser type is typed to `ChatMessageV1`.
- **Done when:** The lockfiles name `@ttt-productions/chat-react` 0.13.21 or later, and the gate is green.
