# @ttt-productions/mobile-core

Generic mobile/browser behavior package.

## Owns

- Viewport height helpers
- iOS Safari fixes
- Keyboard/focused-input helpers
- Safe-area and scroll-lock helpers
- React setup components such as `IOSSetup` and `ViewportHeightSetter`
- Pull-to-refresh gesture handling (`usePullToRefresh`, `PullToRefreshContainer`). The progress ring tracks the pull; `refreshingIndicator` replaces it for the refresh phase, so the app supplies its canonical spinner without this package taking a UI dependency

## Boundary

CSS variable/class names should be neutral or configurable, not TTT-branded.
