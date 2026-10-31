# Adopt @ttt-productions/media-viewer 0.10.22

**What:** `MediaPreview` takes a `placeholder` node that replaces every loading and recovery state on small surfaces.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/media-viewer` 0.10.22.
- **Release:** `./scripts/release-multiple.sh ttt-core query-core chat-react media-viewer patch`.
- **What changed:** Additive. With `placeholder` set, `MediaPreview` renders it for a pending or
  missing URL, an image still loading (instead of the skeleton), every recovery phase (processing,
  finalizing, transient retry, auth retry, hard-unavailable, max-wait), and a failed load with no
  recovery adapter, and renders no recovery label. Without it nothing changes.
- **What the app must change:** Install. Then give each surface too small for a text label (an
  avatar) its empty-state art as `placeholder`, so a recovery label never overflows it. With no
  such surface, the install is the whole adoption.
- **Done when:** The lockfiles name `@ttt-productions/media-viewer` 0.10.22 or later.
