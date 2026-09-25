# Pending package work — Q-Sports 2.0 conversion

The one list of `@ttt-productions/*` changes the Q-Sports 2.0 conversion needs and has not built yet.
It holds only remaining work: an entry is deleted once its package change is published, installed in
Q-Sports, and every Q-Sports spot it skipped has been built.

## How the list works

- **Conversion never stops at a package need.** When a piece of Q-Sports work needs a change in
  `ttt-packages`, the agent does not build that piece — never against unpublished package code, and
  never through an app-side shim. It adds an entry here and keeps converting everything else.
- **`q-core` never appears here.** It lives in the Q-Sports repo during the conversion and is changed
  directly by the unit that needs it.
- **The batch.** DJ and the orchestrator decide together when to run it — there is no fixed count;
  a batch may be three entries or nine, and a blocking entry may be cleared on its own. When a batch
  runs, Q-Sports work pauses: one agent does every entry in it in `ttt-packages` against that repo's
  `CLAUDE.md` and gate, DJ publishes and installs, agents build every skipped Q-Sports spot, the
  entries are deleted, and conversion continues.
- **ttt-prod adoption is DJ's.** When a batch publishes, DJ runs a ttt-prod conversation to adopt the
  changed packages. This list says how Q-Sports adopts, not ttt-prod.

## Entry format

Each entry is one `###` heading naming the change, then:

- **Packages:** the package folders it touches.
- **What changes and why:** the package-side change and the Q-Sports need that forced it.
- **Skipped in Q-Sports:** every spot not built because of it — unit, file or step doc, and what is
  missing there.
- **How Q-Sports adopts:** what gets built at each skipped spot once the change is installed.

## Entries

### theme-core: the viewer settings mechanism — device store for theme and motion, and account sync

- **Packages:** `theme-core` (the server-safe root and `./react`).
- **What changes and why:** Q-Sports 2.0 saves the viewer's theme and motion choice on the device
  and, when signed in, to the account, with a compare prompt when the two differ
  (`q-sports-league/docs/migration-2.0/ui-system/UI_SYSTEM.md` § Settings and § Motion). ttt-prod
  holds the device half app-local — `ttt-master-app/src/components/shared/reduced-motion.tsx`, its
  keys in `ttt-core/src/constants/storage-keys.ts` — and has no account half. Both apps need the whole
  mechanism, so it is built once in `theme-core`, which already owns the theme's device state
  (`ThemeProvider` over `next-themes`) and hardcodes the theme set:
  - **root (server-safe):** the theme set as one declared union — the list `ThemeProvider` passes to
    `next-themes` derives from it — so an app's account schema imports it instead of restating it;
    the name of the `<html>` reduced-motion attribute as a constant;
  - **`./react`, the motion store** — ttt-prod's `reduced-motion.tsx` shape, generic: effective
    reduced motion is the device's `prefers-reduced-motion` request OR the saved device preference,
    the device request always winning; a hook for components and a snapshot read for JS-scheduled
    motion; stamps the `<html>` attribute the app's CSS kill switch keys on; same-tab change event
    and cross-tab `storage` sync. The storage key and change-event name are supplied by the app
    (ARCH-201) — nothing TTT- or Q-Sports-named in the package. The CSS kill switch stays app-side,
    beside the rule that defines it, as it does in ttt-prod;
  - **`./react`, the account sync** over an app-supplied adapter (the signed-in state, the account's
    saved theme and motion values, and a save function): every change goes to the device at once
    and, signed in, to the account; a device with nothing saved takes the account's values silently;
    when the account's values differ from the device's, one non-blocking prompt state covers every
    differing setting — use the account's values, or save the device's to the account — and
    dismissing it keeps the device's values while the device remembers that exact difference (under
    an app-supplied key) so it does not ask again until something changes; no saved value can force
    motion on while the device asks for less. The prompt's UI stays the app's.
- **Skipped in Q-Sports:** nothing yet — the batch runs before Unit 1.5's frontend lane starts.
  That lane's device store for theme and motion (`CONVERSION_ORDER.md` Unit 1.5) and everything
  that reads the motion store — the transition link and page transitions, the score-change effect,
  the landing hero's rotation — wait on it.
- **How Q-Sports adopts:** Unit 1.5 mounts the store with `q-core`'s storage keys
  (`packages/q-core/src/constants/storage-keys.ts`) and every motion decision reads it; Unit 2
  builds the settings page and its settings callable as the sync's adapter, and adds `theme` —
  typed by the theme-core union — and `reducedMotion` to `UserPrivateDataSchema`.
