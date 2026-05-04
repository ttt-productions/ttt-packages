# @ttt-productions/file-input

File upload input components with media-specific variants, validation, image cropping, camera capture, and auto-format detection. Provides the UI layer for selecting and preparing files before upload.

## Version
0.2.4

## Dependencies
Runtime: @ttt-productions/ui-core, @ttt-productions/media-contracts, react-easy-crop.
Peer: react, react-dom, lucide-react.

## Entry Points

- `@ttt-productions/file-input` — server-safe types plus MIME/content-type helpers.
- `@ttt-productions/file-input/react` — React file/media input components.

## What It Contains

### Server-safe entry point (`index.ts`)
- Types from `types.ts`
- `inferContentType(file, fallbackKind?)`
- `ensureFileWithContentType(file, fallbackKind?)`

### React entry point (`react/index.ts`)
- `FileInput` — Generic file input with drag-and-drop
- `ImageInput` — Image-specific input with preview, cropping support, and constraints validation
- `VideoInput` — Video input with duration validation and preview
- `AudioInput` — Audio input with duration validation
- `MediaInput` — Universal media input that adapts based on accepted file types
- `PhotoCaptureModal` — Camera capture for taking photos directly
- `RecordDialog` — Audio/video recording dialog with idle → recording → preview state machine

### Internal utilities (`lib/`)
- `image-utils.ts` — Image manipulation helpers (crop, resize, format conversion)
- `read-media-meta.ts` — Extract media metadata (dimensions, duration, codec info)
- `validate-media-duration.ts` — Duration constraint validation for video/audio
- `infer-content-type.ts` — Guarantees no File with an empty or octet-stream type reaches upload-core.

## Key Design Decisions
- All media inputs validate against `MediaClientConstraints` from media-contracts (max size, accepted formats, duration limits).
- Image cropping happens client-side before upload to reduce server processing.
- Camera capture (`PhotoCaptureModal`) uses the browser's MediaDevices API.
- Components are unstyled shells that consume CSS variables — apps provide their own styling.
- React components live on `/react`; type-only imports and content-type helpers stay on main.

## Files
```
src/
  index.ts, types.ts
  lib/
    image-utils.ts, infer-content-type.ts, read-media-meta.ts,
    validate-media-duration.ts
  react/
    index.ts
    components/
      file-input.tsx, image-input.tsx, video-input.tsx, audio-input.tsx
      media-input.tsx, photo-capture-modal.tsx, record-dialog.tsx
      image-cropper-modal.tsx, auto-format-modal.tsx
      media-constraints-hint.tsx
```
