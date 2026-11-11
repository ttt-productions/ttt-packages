# Adopt @ttt-productions/ui-core 0.11.44

**What:** ui-core gains `ClippedText`, the one clipped-text component, and an accordion row that shrinks so a long title clips.
**Severity:** medium

- **Package and version:** `@ttt-productions/ui-core` 0.11.44.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:**
  - `ClippedText` (with `ClippedTextProps`, `ClippedTextClip`, `ClippedTextLines`) from
    `@ttt-productions/ui-core/react` clips `text` to `lines` 1 (default), 2 or 3 through theme-core's
    `.single-line-truncate` / `.two-line-clamp` / `.three-line-clamp`, or with `namePieces` splits a
    name at its first space so the line breaks only there and each piece clips on its own. `text` is
    always the element's `title` and its content, so the full value stays its accessible name. It
    renders a `span`, or with `asChild` the caller's one child element (a heading, a link) with the
    child's props kept (`docs/packages/ui-core.md` § Clipped text). It needs theme-core 0.12.18 for
    the two new classes.
  - `DialogContent` and `AlertDialogContent` (and so `ConsequenceDialog`) fit themselves above the
    phone keyboard and keep the focused field in view, through mobile-core's
    `useKeyboardViewportFit`. ui-core now depends on `@ttt-productions/mobile-core` (0.9.8 or
    later), so the two are installed together.
  - `AccordionTrigger`'s header and trigger may shrink, and its content takes the row's width beside
    the chevron, so a one-line child clips instead of widening the page. Accordions look as before.
- **What the app must change:**
  - The install.
  - Nothing to change for `ClippedText` or the accordion.
  - Install mobile-core 0.9.8 or later beside ui-core. Remove any keyboard handling a dialog does
    itself: a `useKeyboard`, `useKeepFocusedInputVisible` (or the app's motion adapter for it) or
    `KeyboardAvoidingView` call placed in dialog content, and any private keyboard-height or
    visual-viewport hook written for dialogs. The app's page-level `ViewportHeightSetter` stays.
- **Done when:** ttt-prod's lockfile names `@ttt-productions/ui-core` 0.11.44 or later, and no dialog content calls a keyboard or visual-viewport hook itself.
