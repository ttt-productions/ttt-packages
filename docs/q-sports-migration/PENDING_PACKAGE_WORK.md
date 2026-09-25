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

### ui-core: a stable hook class on `Button` for app-side press styling

- **Packages:** `ui-core`.
- **What changes and why:** Q-Sports' design gives every button an instant press (`transform: scale`
  on `:active`, `q-sports-league/docs/migration-2.0/ui-system/UI_SYSTEM.md` § Motion). ui-core's
  `Button` renders only Tailwind utilities, so the one way an app can target it is by matching its
  internal utility string (`.inline-flex.justify-center.whitespace-nowrap`) — which re-styles a
  ui-core component through its private classes (FRONTEND-006), silently breaks when ui-core changes
  that string, also catches `TabsTrigger`, and blinds the app's class-system guard to those three
  utility names. `Button` gains a stable hook class (or `data-slot`) the way theme-core's hook
  classes (`.card-border`, `.elevation-raised`) give apps a named target, so an app styles every
  button's press from its own stylesheet.
- **Skipped in Q-Sports:** Unit 1.5 — the button press rule in `src/app/styles/components.css`
  (removed until this ships).
- **How Q-Sports adopts:** one `:active` rule in `components.css` keyed on the hook class, reading
  the motion tokens; covered by the kill switch.

### theme-core: a generic device-preference store over the guarded storage

- **Packages:** `theme-core` (`./react`).
- **What changes and why:** theme-core's motion store and viewer-settings sync already own guarded
  `localStorage` access (reads fall back to nothing-saved, a throwing write is held in memory for the
  page) and same-tab + cross-tab sync, in the internal `src/react/local-storage.ts`. Q-Sports needs
  the same device-local mechanism for its other per-device choices — the admin sidebar's collapsed
  state and each stats table's saved View state — and an app-side copy of theme-core's internal
  helper is a fork of a shared mechanism (ENG-003). ttt-prod's app-local stores (`text-size.tsx`,
  the companion stores) are the same shape. theme-core exports one generic store factory — an
  app-supplied storage key, change event, and parse/serialize — built on the same guarded storage
  and sync its motion store uses, so every device preference in either app runs on one mechanism.
- **Skipped in Q-Sports:** Unit 1.5 — `src/lib/device-storage.ts` is removed; the admin sidebar's
  collapsed state and the stats table's saved View state are not persisted until this ships (their
  keys already exist in `q-core`'s `constants/storage-keys.ts`, and the View state's merge logic is
  built and tested).
- **How Q-Sports adopts:** the sidebar's collapsed state and the stats table's View state each mount
  one store from the factory with their `q-core` key and change event; the persistence tests are
  written then.

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
- **Published and installed** (`theme-core` 0.12.8); Unit 1.5 mounted the motion store with
  `q-core`'s storage keys and every motion decision reads it.
- **Skipped in Q-Sports — still to adopt:** Unit 2 — the settings page and the account sync.
- **How Q-Sports adopts:** Unit 2 builds the settings page and its settings callable as the sync's
  adapter (`accountId` is the signed-in uid), adds `theme` — typed by the theme-core union — and
  `reducedMotion` to `UserPrivateDataSchema`, and adds the remembered-dismissal key to `q-core`'s
  `constants/storage-keys.ts`; this entry is deleted then.
