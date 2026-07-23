# @ttt-productions/file-input

Generic file, image, video, and audio input package.

## Owns

- Media input components
- File pickers, camera capture, and crop UI
- Client-side file validation helpers such as `validateAndNormalizeUploadFile`
- Input behavior driven by neutral `MediaOriginSpec`

## Boundary

The package consumes generic media shapes from `media-schemas`; it does not know `FileOrigin` or `TTT_MEDIA_SPECS`. TTT passes concrete specs from `ttt-core` at the app boundary.

`MediaInput` and the recording preview render through `@ttt-productions/media-viewer` (`MediaPreview`) — the package's one intra-Tier-1 dependency, so picked and recorded files use the same canonical viewer. Selected-file UI uses semantic labels such as `Audio selected`; original filenames remain upload metadata and are never displayed by this package.

`MediaInput` exposes an additive imperative handle (`MediaInputHandle`) via `ref`: `openSelection()` activates the SAME trigger semantics as a human click — one enabled action runs directly through the canonical selection path (honoring `onBeforeSelect`, validation, and crop), multiple actions open the choice dropdown — and no-ops while `disabled`/`isLoading`. It never touches the hidden input directly, so none of the trigger gates are bypassed. Consumers use it to re-open the picker from an external control (e.g. a chat "Attach again" action).
