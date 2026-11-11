# Adopt @ttt-productions/theme-core 0.12.19

**What:** theme-core gains `.inline-name` and `.machine-text`, the classes ui-core's `InlineName` and `MachineText` draw through; its guarded storage functions and device-preference store move to storage-core.
**Severity:** low

- **Package and version:** `@ttt-productions/theme-core` 0.12.19.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** `components.css` adds `.inline-name` (`overflow-wrap: anywhere`: a name in a
  sentence wraps with it and breaks mid-word only where it has no space) and `.machine-text`
  (`word-break: break-all`: machine text breaks at any character). Neither clips. Existing classes
  are unchanged (`docs/packages/theme-core.md` § Recipes and components read tokens, not literals).
- **What changed (storage):** the root no longer exports `readStoredValue`, `writeStoredValue` or
  `DeviceStorageArea`, and `./react` no longer exports `createDevicePreferenceStore`,
  `DevicePreferenceStore` or `DevicePreferenceStoreConfig`: they are storage-core's
  (`@ttt-productions/storage-core` 0.0.2), unchanged in behaviour, and theme-core keeps no second
  path to them. theme-core's motion store and account sync read and write through storage-core,
  which is a new optional peer. `createReducedMotionStore`, `ViewerSettingsSyncProvider` and every
  other export are unchanged.
- **What changed (theme key):** `ThemeProvider`'s `storageKey` is required: theme-core no longer
  falls back to next-themes' default `'theme'`. The provider hands exactly the app's key to
  next-themes and to the account sync. A mount with no `storageKey` fails the type check. ttt-prod's
  one mount, in `src/app/layout.tsx`, already passes `storageKey={THEME_STORAGE_KEY}` (and
  `src/__tests__/app/root-layout-theme-key.test.ts` holds it), so nothing changes for it.
- **What the app must change:** the install. The two classes reach the page only through ui-core
  0.11.45's `InlineName` and `MachineText`; ttt-prod's repo-guards truncation facts (repo-guards
  0.1.58) list them as its break classes and break owners.
  - Its imports of `readStoredValue` / `writeStoredValue` (from the root) and
    `createDevicePreferenceStore` (from `./react`) come from `@ttt-productions/storage-core` and
    `@ttt-productions/storage-core/react`, and storage-core 0.0.2 or later joins ttt-prod's
    dependencies.
- **Done when:** the lockfile names `@ttt-productions/theme-core` 0.12.19 or later and no ttt-prod
  file imports a storage function or a device-preference store from theme-core.
