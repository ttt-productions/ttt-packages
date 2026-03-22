# @ttt-productions/file-input

File upload input components with media-specific variants, validation, image cropping, camera capture, and auto-format detection. Provides the UI layer for selecting and preparing files before upload.

## Version
0.0.7

## Dependencies
Runtime: @ttt-productions/ui-core, @ttt-productions/media-contracts, react-easy-crop.
Peer: react, react-dom, lucide-react.

## What It Contains

### Input Components
- `FileInput` — Generic file input with drag-and-drop
- `ImageInput` — Image-specific input with preview, cropping support, and constraints validation
- `VideoInput` — Video input with duration validation and preview
- `AudioInput` — Audio input with duration validation
- `MediaInput` — Universal media input that adapts based on accepted file types

### Modals
- `ImageCropperModal` — Crop/resize images before upload (uses react-easy-crop)
- `PhotoCaptureModal` — Camera capture for taking photos directly
- `AutoFormatModal` — Auto-format detection and conversion

### Utilities (`lib/`)
- `image-utils.ts` — Image manipulation helpers (crop, resize, format conversion)
- `read-media-meta.ts` — Extract media metadata (dimensions, duration, codec info)
- `validate-media-duration.ts` — Duration constraint validation for video/audio

### Constraint Hints
- `MediaConstraintsHint` — Displays accepted formats, size limits, and duration limits to the user

### Types (`types.ts`)
Input component props, crop specs, validation result types. Uses `MediaClientConstraints` from media-contracts.

## Key Design Decisions
- All media inputs validate against `MediaClientConstraints` from media-contracts (max size, accepted formats, duration limits).
- Image cropping happens client-side before upload to reduce server processing.
- Camera capture (`PhotoCaptureModal`) uses the browser's MediaDevices API.
- Components are unstyled shells that consume CSS variables — apps provide their own styling.

## Files
```
src/
  index.ts, types.ts
  components/
    file-input.tsx, image-input.tsx, video-input.tsx, audio-input.tsx
    media-input.tsx, photo-capture-modal.tsx
    image-cropper-modal.tsx, auto-format-modal.tsx
    media-constraints-hint.tsx
  lib/
    image-utils.ts, read-media-meta.ts, validate-media-duration.ts
```
