# Adopt @ttt-productions/storage-core 0.0.2

**What:** A new shared package for guarded browser storage: the guarded read and write and the device-preference store move out of theme-core into it, and every package that stores something now goes through it.
**Severity:** medium

- **Package and version:** `@ttt-productions/storage-core` 0.0.2 (new).
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What the package owns** (`docs/packages/storage-core.md`):
  - `.` — `readStoredValue(key, area?)`, `writeStoredValue(key, value, area?)` (`area` is `'local'`,
    the default, or `'session'`), `noteStoredValue(key, value)`, and the type `DeviceStorageArea`:
    the same functions theme-core exported, unchanged in behaviour. With site data blocked a read is
    "nothing saved" and a refused write is held in memory for the page's life, in one held value
    per key that every reader of the key shares, the packages' own reads included.
  - `./react` — `createDevicePreferenceStore` and its types `DevicePreferenceStore` and
    `DevicePreferenceStoreConfig`, unchanged in behaviour.
  - theme-core, consent-core, auth-core, ui-core and media-viewer declare it an optional peer, so
    the app installs the one copy.
- **What the app must change:**
  - Add `@ttt-productions/storage-core` to ttt-prod's `dependencies`.
  - Every import of `readStoredValue` / `writeStoredValue` from `@ttt-productions/theme-core` comes
    from `@ttt-productions/storage-core` (theme-core no longer exports them):
    `src/app/register/page.tsx`, `src/app/take-it-down/idempotency-key.ts`,
    `src/components/version-gate.tsx`, `src/components/site-tour/pending-choice.tsx`,
    `src/components/shared/bill-the-understudy.tsx`, `src/components/shared/sign-in-to-see.tsx`, and
    the tests `src/__tests__/components/sign-in-to-see.test.tsx` and
    `src/__tests__/components/version-gate.test.tsx`.
  - Every import of `createDevicePreferenceStore` from `@ttt-productions/theme-core/react` comes
    from `@ttt-productions/storage-core/react`: `src/components/shared/bill-the-understudy.tsx`
    (the hidden and companion stores) and `src/components/shared/text-size.tsx`.
  - The `browserStorage` guard fact in `src/__tests__/guards/config/frontend-actions.ts` names
    storage-core as the helper: `helper: "storage-core's readStoredValue / writeStoredValue"`.
  - The docs that name theme-core as the helper's home name storage-core (a search of ttt-prod's
    `docs/`, outside `docs/work/`, finds these four):
    - `docs/playbooks/codebase-hygiene-playbook.md` — the browser-storage check's "goes through
      theme-core's guarded helpers or a `createDevicePreferenceStore`";
    - `docs/design/green-room-mascots.md` — "Hidden and Companion are theme-core device-preference
      stores";
    - `docs/design/settings-page.md` — "Every one of these stores goes through theme-core's guarded
      storage";
    - `docs/design/ttt-productions-version-gate.md` § Storage — "goes through theme-core's guarded
      helpers (`readStoredValue` / `writeStoredValue`…)".
    theme-core's `createReducedMotionStore`, which `green-room-mascots.md` and `ui-design-system.md`
    also name, stays theme-core's.
- **What changes for ttt-prod:** its saved redirect path is now one store. auth-core's
  `useAuthGuard` (auth-core 1.6.22) reads and writes `REDIRECT_PATH_KEY` through storage-core, the
  same as the register page and the sign-in link, so with site data blocked a path one side saved is
  the path the other reads for the page's life (each side held it where the other could not see it
  before).
- **Done when:** the lockfile names `@ttt-productions/storage-core` 0.0.2 or later, no ttt-prod file
  imports a storage function or a device-preference store from theme-core, the `browserStorage`
  guard names storage-core and is green with no reviewed entry, and the Normal TTT Test Flow is
  green.
