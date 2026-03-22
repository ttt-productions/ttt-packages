# @ttt-productions/mobile-core

Mobile-specific utilities and responsive helpers for PWA/mobile web. Handles the many quirks of iOS Safari, virtual keyboards, safe areas, viewport units, scroll locking, and pull-to-refresh.

## Version
0.2.8

## Dependencies
Peer: react, react-dom.

## What It Contains

### Viewport (`viewport/`)
- `useVisualViewport()` — Tracks the visual viewport (accounts for keyboard, zoom, browser chrome)
- `useViewportHeightVars()` — Sets CSS custom properties for viewport height (works around `100vh` issues on mobile)

### Keyboard (`keyboard/`)
- `useKeyboard()` — Detects virtual keyboard open/close state and height
- `useKeepFocusedInputVisible()` — Scrolls focused inputs into view when keyboard opens
- `useInputNavigation()` — Tab/shift-tab navigation between form inputs (with focus order helpers)
- `KeyboardAvoidingView` — Component that adjusts layout when virtual keyboard appears

### Safe Area (`safe-area/`)
- `useSafeAreaInsets()` — Reads CSS `env(safe-area-inset-*)` values
- `SafeArea` — Component wrapper that applies safe area padding

### Scroll (`scroll/`)
- `useScrollLock()` — Prevents body scroll (for modals, drawers)

### iOS Safari Fixes (`ios/`)
- `useIosSafariFixes()` — Applies various iOS Safari workarounds
- `useNoRubberBand()` — Prevents iOS rubber-band/overscroll behavior

### Pull to Refresh (`pull-to-refresh/`)
- `usePullToRefresh()` — Pull-to-refresh gesture detection hook
- `PullToRefreshContainer` — Component wrapper with pull-to-refresh UI

### Environment (`env.ts`)
Mobile environment detection (iOS, Android, standalone PWA, etc.)

### Types (`types.ts`)
Shared type definitions for mobile utilities.

## Key Design Decisions
- All hooks are client-side only ('use client') — they rely on browser APIs.
- Viewport height CSS variables work around the notorious `100vh` issue on mobile Safari where the address bar height is included.
- `KeyboardAvoidingView` is essential for chat interfaces and forms on mobile — used by chat-core's ChatShell.

## Files
```
src/
  index.ts, types.ts, env.ts
  viewport/useVisualViewport.ts, useViewportHeightVars.ts
  keyboard/useKeyboard.ts, useKeepFocusedInputVisible.ts,
           useInputNavigation.ts, KeyboardAvoidingView.tsx,
           focusOrder.ts
  safe-area/useSafeAreaInsets.ts, SafeArea.tsx
  scroll/useScrollLock.ts
  ios/useIosSafariFixes.ts, useNoRubberBand.ts
  pull-to-refresh/usePullToRefresh.ts, PullToRefreshContainer.tsx
```
