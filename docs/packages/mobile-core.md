# @ttt-productions/mobile-core

Generic mobile/browser behavior package.

## Owns

- Viewport height helpers
- iOS Safari fixes
- Keyboard/focused-input helpers. `useInputNavigation` and `useKeepFocusedInputVisible` treat an element carrying `data-<cssPrefix>-input` as an input, with the same `cssPrefix` option (default `app`) as the other helpers
- The on-screen keyboard reading. `useKeyboard` reads the keyboard open when the visual viewport is more than 80px shorter than the window it started from — iOS Safari, Chrome on iOS (WebKit) and Chrome on Android (108+, whose default `interactive-widget=resizes-visual` matches iOS) all shrink only the visual viewport for the keyboard, leaving the layout viewport, `position: fixed`, and the `vh`/`dvh` units where they were. Focus moving from one field to the next keeps it open: a blur measures the visual viewport again rather than assuming the keyboard closed
- Fitting a centred fixed overlay above the keyboard — `useKeyboardViewportFit(ref)`. While the keyboard is open it returns the element's `top` (the visible viewport's centre, `offsetTop + height / 2`, for an element centred with `translateY(-50%)`), a `maxHeight` of the visible height less an 8px margin at each edge, and `overflowY: auto`; and it scrolls the focused element inside the element into view, on focus and whenever the fitted height changes, by setting the element's own `scrollTop` — no smooth scroll is requested, so the app's reduced-motion switch governs any motion (RULE-STD-FRONTEND-204). With no keyboard, no visual viewport, or a pinch-zoomed page it returns `undefined`, so the element keeps its own layout. ui-core's `DialogContent` and `AlertDialogContent` are its consumers
- Safe-area and scroll-lock helpers
- React setup components such as `IOSSetup` and `ViewportHeightSetter`
- Pull-to-refresh gesture handling (`usePullToRefresh`, `PullToRefreshContainer`). The progress ring tracks the pull; `refreshingIndicator` replaces it for the refresh phase, so the app supplies its canonical spinner without this package taking a UI dependency

## Boundary

CSS variable/class names should be neutral or configurable, never app-branded.
