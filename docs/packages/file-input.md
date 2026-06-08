# @ttt-productions/file-input

Generic file, image, video, and audio input package.

## Owns

- Media input components
- File pickers, camera capture, and crop UI
- Client-side file validation helpers such as `validateAndNormalizeUploadFile`
- Input behavior driven by neutral `MediaOriginSpec`

## Boundary

The package consumes generic media shapes from `media-schemas`; it does not know `FileOrigin` or `TTT_MEDIA_SPECS`. TTT passes concrete specs from `ttt-core` at the app boundary.

`MediaInput` renders the selected-file preview through `@ttt-productions/media-viewer` (`MediaPreview`) — the package's one intra-Tier-1 dependency, so the whole app previews picked files through the same canonical viewer.
