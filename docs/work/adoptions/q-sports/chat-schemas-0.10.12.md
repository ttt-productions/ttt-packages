# Adopt @ttt-productions/chat-schemas 0.10.12

**What:** Each chat internal call reads its own body, typed, with no cast.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/chat-schemas` 0.10.12.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** Every `CHAT_INTERNAL_CALLS` entry carries `read(body)`, which parses the body with that call's schema and returns it with its operation id, or `null`. `parseChatInternalRequest` uses it; `chatInternalOperationId` now parses its body too and throws on one that does not match its path.
- **What the app must change:** Install. Nothing changes for a caller that passes a body of its path's type.
- **Done when:** The lockfiles name 0.10.12 or later.
