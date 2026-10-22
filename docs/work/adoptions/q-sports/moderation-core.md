# Adopt @ttt-productions/moderation-core 0.8.4

**What:** BEHAVIOR: video moderation fails closed like image moderation: an analysis error or an empty frame list now returns `safe: false` ('Content moderation check failed') instead of allowing the video.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (Phase 1)

- **Package and version:** `@ttt-productions/moderation-core` 0.8.4.
- **Release:** `./scripts/release-multiple.sh dev-standards module-core input-format-core edge-protocol-core realtime-core firebase-helpers ui-core repo-guards theme-core query-core monitoring-core media-schemas chat-schemas report-core audit-core notification-core ttt-core mobile-core media-viewer file-input auth-core upload-core upload-ui media-processing-core chat-core chat-react rate-limit-core moderation-core patch`.
- **What changed:** BEHAVIOR: video moderation fails closed like image moderation: an analysis error or an empty frame list now returns `safe: false` ('Content moderation check failed') instead of allowing the video. Comments across the package follow the tightened shared comment rules (RULE-STD-COMMENT-001, RULE-STD-COMMENT-012); rule citations in code use the new `RULE-STD-*` IDs.
- **What the app must change:** No code change; a video the analyzer could not check is now rejected instead of published.
- **Done when:** The lockfiles name `@ttt-productions/moderation-core` 0.8.4 or later, the work above is done, and the gate is green.
