# Adopt @ttt-productions/file-input 0.11.18

**What:** `FileInputProps` moves to `./react` with real button types; effect dependencies are fixed at the source.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/file-input` 0.11.18.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `FileInputProps` is exported from `@ttt-productions/file-input/react` (beside `FileInput`), no longer from the root. Its `variant` and `size` are ui-core's `ButtonProps['variant']` / `ButtonProps['size']` instead of `any`.
  - `PhotoCaptureModal` acquires the camera when it opens with no suppressed `exhaustive-deps`; a re-render while open keeps the one camera.
  - Internal typing and empty-catch cleanups.
- **What the app must change:** Install. Import `FileInputProps` from `@ttt-productions/file-input/react` if the app imports it from the root.
- **Done when:** The lockfiles name `@ttt-productions/file-input` 0.11.18 or later, and the gate is green.
