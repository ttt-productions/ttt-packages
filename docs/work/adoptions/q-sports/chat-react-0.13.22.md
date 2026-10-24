# Adopt @ttt-productions/chat-react 0.13.22

**What:** The channel client checks a snapshot frame before it applies it.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/chat-react` 0.13.22.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** A `snapshot` frame is read by `readChannelSnapshot`, which accepts it only when it names its last message seq; `WireChannelSnapshot.readSeq` is optional, as the client already treated it.
- **What the app must change:** Install. Nothing else.
- **Done when:** The lockfiles name 0.13.22 or later.
