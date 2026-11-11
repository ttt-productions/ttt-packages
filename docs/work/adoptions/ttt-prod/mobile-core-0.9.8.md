# Adopt @ttt-productions/mobile-core 0.9.8

**What:** mobile-core fits a centred overlay above the phone keyboard, and its keyboard reading stays open while focus moves between fields.
**Severity:** medium

- **Package and version:** `@ttt-productions/mobile-core` 0.9.8.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:**
  - `./react`: `useKeyboardViewportFit(ref)` — while the on-screen keyboard is open it returns the
    style that centres a fixed, `translateY(-50%)`-centred element on the visible viewport, caps its
    height at the visible height less an 8px margin at each edge, and lets it scroll; it keeps the
    focused element inside it in view. With no keyboard it returns `undefined`. ui-core's
    `DialogContent` and `AlertDialogContent` (and so `ConsequenceDialog`) use it, so every dialog
    fits above the keyboard with no call of its own.
  - `useKeyboard`: a blur no longer reads the keyboard closed on a browser with a visual viewport; it
    measures the viewport again, so moving focus from one field to the next keeps it open.
- **What the app must change:** the install, beside `@ttt-productions/ui-core` 0.11.44 or later,
  which depends on mobile-core 0.9.8 or later. Any dialog that calls a keyboard hook itself to stay
  clear of the keyboard (`useKeyboard`, `useKeepFocusedInputVisible` or the app's motion adapter for
  it, `KeyboardAvoidingView`, or a private keyboard-height or visual-viewport hook) drops that call
  once ui-core's dialog contents do it. The app's page-level `ViewportHeightSetter` and its
  motion adapter for `useKeepFocusedInputVisible` stay.
- **Done when:** The lockfiles name `@ttt-productions/mobile-core` 0.9.8 or later, and no dialog
  content calls a keyboard or visual-viewport hook itself.
