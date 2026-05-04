# @ttt-productions/mobile-core

Mobile-specific utilities and responsive helpers for PWA/mobile web. Handles the many quirks of iOS Safari, virtual keyboards, safe areas, viewport units, scroll locking, and pull-to-refresh.

## Version
0.2.11

## Dependencies
Peer: react, react-dom.

## Entry Points

- `@ttt-productions/mobile-core` — server-safe types and environment helpers.
- `@ttt-productions/mobile-core/react` — browser/React hooks and components.

## What It Contains

### Server-safe entry point (`index.ts`)
- Shared types from `types.ts`
- Environment helpers from `env.ts`

### React entry point (`react/index.ts`)
- Viewport: `useVisualViewport()`, `useViewportHeightVars()`
- Keyboard: `useKeyboard()`, `useKeepFocusedInputVisible()`, `useInputNavigation()`, `KeyboardAvoidingView`
- Safe area: `useSafeAreaInsets()`, `SafeArea`
- Scroll: `useScrollLock()`
- iOS Safari fixes: `useIosSafariFixes()`, `useNoRubberBand()`
- Pull to refresh: `usePullToRefresh()`, `PullToRefreshContainer`

## Key Design Decisions
- React hooks/components rely on browser APIs and stay behind `/react`.
- Viewport height CSS variables work around the notorious `100vh` issue on mobile Safari where the address bar height is included.
- `KeyboardAvoidingView` is essential for chat interfaces and forms on mobile — used by chat-core's ChatShell.

## Files
```
src/
  index.ts, types.ts, env.ts
  react/
    index.ts
    viewport/useVisualViewport.ts, useViewportHeightVars.ts
    keyboard/useKeyboard.ts, useKeepFocusedInputVisible.ts,
             useInputNavigation.ts, KeyboardAvoidingView.tsx,
             focusOrder.ts
    safe-area/useSafeAreaInsets.ts, SafeArea.tsx
    scroll/useScrollLock.ts
    ios/useIosSafariFixes.ts, useNoRubberBand.ts
    pull-to-refresh/usePullToRefresh.ts, PullToRefreshContainer.tsx
```
