# @ttt-productions/media-viewer

Media display components for rendering images, video, and audio with loading states, error handling, and fallbacks. Used wherever media content is displayed in the UI (feeds, chat messages, library items, profiles).

## Version
0.2.11

## Dependencies
Runtime: @ttt-productions/media-contracts, @ttt-productions/ui-core.
Peer: react, react-dom, lucide-react, react-intersection-observer.

## What It Contains

### Primary Components
- `MediaViewer` — Smart component that renders the correct viewer based on media type (image/video/audio). Main entry point for displaying processed media.
- `MediaPreview` — Lightweight preview variant (thumbnails, compact views)

### Type-Specific Viewers
- `ImageViewer` — Image display with lazy loading via intersection observer
- `VideoViewer` — Video player with controls
- `AudioViewer` — Audio player with controls

### Fallbacks (`fallback.tsx`)
- `MediaFallbackLink` — Download link fallback when media can't be displayed inline
- `shouldShowFallback(media)` — Determine if fallback is needed
- `EmptyFallback` — Placeholder for missing media
- `ErrorFallback` — Error state display

### Job Status (`components/media-job-status-list.tsx`)
- `MediaJobStatusList` — Displays processing status for pending media jobs

### Types (`types.ts`)
Component prop types and viewer configuration interfaces.

## Key Design Decisions
- `MediaViewer` uses `SimplifiedMediaType` from media-contracts to route to the correct viewer.
- Images use `react-intersection-observer` for lazy loading — only loads when scrolled into view.
- Fallback chain: try inline viewer → fallback link → error state.
- Components consume CSS variables from theme-core for consistent styling.

## Files
```
src/
  index.ts, types.ts
  media-viewer.tsx          — MediaViewer + MediaPreview
  image-viewer.tsx
  video-viewer.tsx
  audio-viewer.tsx
  fallback.tsx
  components/
    media-job-status-list.tsx
```
