# @ttt-productions/media-viewer

Media display components for rendering images, video, and audio with loading states, error handling, and fallbacks. Used wherever media content is displayed in the UI (feeds, chat messages, library items, profiles).

## Version
0.2.12

## Dependencies
Runtime: @ttt-productions/media-contracts, @ttt-productions/ui-core.
Peer: react, react-dom, lucide-react, react-intersection-observer.

## Entry Points

- `@ttt-productions/media-viewer` — server-safe media viewer prop/type exports only.
- `@ttt-productions/media-viewer/react` — React media viewer components.
- `@ttt-productions/media-viewer/styles` — CSS side-effect import.

## What It Contains

### Server-safe entry point (`index.ts`)
Type exports from `types.ts`: `MediaViewerType`, `FallbackMode`, `BaseMediaProps`, `ImageViewerProps`, `VideoViewerProps`, `AudioViewerProps`, `MediaPreviewProps`, and `MediaViewerProps`.

### React entry point (`react/index.ts`)
- `MediaViewer` — Smart component that renders the correct viewer based on media type (image/video/audio). Main entry point for displaying processed media.
- `MediaPreview` — Lightweight preview variant (thumbnails, compact views)
- `ImageViewer` — Image display with lazy loading via intersection observer
- `VideoViewer` — Video player with controls
- `AudioViewer` — Audio player with controls
- `MediaFallbackLink`, `shouldShowFallback`, `EmptyFallback`, `ErrorFallback`

### Job Status (`components/media-job-status-list.tsx`)
- `MediaJobStatusList` — Displays processing status for pending media jobs. This file exists in source but is not exported by the public barrels in the current package.

## Key Design Decisions
- `MediaViewer` uses `SimplifiedMediaType` from media-contracts to route to the correct viewer.
- Images use `react-intersection-observer` for lazy loading — only loads when scrolled into view.
- Fallback chain: try inline viewer → fallback link → error state.
- Components consume CSS variables from theme-core for consistent styling.
- Component runtime exports live on `/react`; main is type-only.

## Files
```
src/
  index.ts, types.ts
  react/
    index.ts
    media-viewer.tsx, image-viewer.tsx, video-viewer.tsx
    audio-viewer.tsx, fallback.tsx
  components/
    media-job-status-list.tsx
  styles/
    media-viewer.css
```
