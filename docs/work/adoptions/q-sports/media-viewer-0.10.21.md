# Adopt @ttt-productions/media-viewer 0.10.21

**What:** The waveform visualizer takes narrow analyser and canvas types.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/media-viewer` 0.10.21.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** `startWaveformLoop` and `drawIdleFrame` take `VisualizerAnalyser`, `VisualizerCanvas` and `VisualizerContext` — the slices of an `AnalyserNode`, a canvas, and its 2d context they use (exported from the root). The real Web Audio and DOM objects are each one.
- **What the app must change:** Install. A caller passing real objects changes nothing; a test fake is typed as these, with no cast.
- **Done when:** The lockfiles name 0.10.21 or later.
