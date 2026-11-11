# @ttt-productions/storage-core

Guarded browser storage: the one read and write of local and session storage, and the
device-preference store built on it. Every package and every app that stores something in the
browser goes through it.

## Owns

- **The guarded read and write.** `readStoredValue(key, area?)` and `writeStoredValue(key, value, area?)`
  (`area` is `'local'`, the default, or `'session'`, typed `DeviceStorageArea`). A browser that
  blocks site data throws on every `localStorage` / `sessionStorage` call, even on reading the
  property, so a blocked read is "nothing saved" and a refused write — a removal (`null`) included —
  is held in memory for the life of the page. Neither function throws, and both do nothing useful
  without a window (a read is `null`). Blocked storage is the viewer's setting, not a defect, so it
  is not reported (RULE-STD-FRONTEND-010).
- **One held value per key.** The values held for a blocked page live in one map per area, inside
  this package, so every reader of a key — a package or the app — reads what any writer saved. A
  later write the browser accepts replaces the held value.
- **Recording a value another writer stored.** `noteStoredValue(key, value)` records a value that a
  library wrote to local storage itself (theme-core's account sync uses it for the theme
  `next-themes` writes): when local storage holds that value nothing is held, and when it does not,
  the value is held for the page. Without a window it does nothing, so a server never holds a value
  one request noted for the next.
- **The device-preference store.** `createDevicePreferenceStore<T>({ storageKey, changeEvent, parse,
  serialize, fallback })` is called once, at module scope, for one device-local choice with the
  app's key and event. `parse(stored)` turns a saved string into a value, or `undefined` for one it
  does not recognise; `serialize(value)` gives the string to save; `fallback` is the value while
  nothing is saved, the saved string is unrecognised, or storage is blocked, and on the server and
  during hydration. The store returns `get()`, `set(value)`, `clear()` (removes the saved value, so it
  reads `fallback`), `subscribe(onChange)`, and the reactive `useValue()`. A `set` or `clear`
  notifies its own tab through the app's change event and other tabs through the native `storage`
  event, so every open tab reads the same value. The same saved string always yields the same value
  object, so a parsed object is a stable React snapshot. The store reads and writes through the
  guarded functions above, so it shares their held values.

## Entry points

- `.` — `readStoredValue`, `writeStoredValue`, `noteStoredValue`, `DeviceStorageArea`. No React and
  no import at all; it reads `window` only when called.
- `./react` — `createDevicePreferenceStore`, `DevicePreferenceStore`, `DevicePreferenceStoreConfig`.

## Boundary

- No dependencies. React is an optional peer, used only by `./react`.
- A package or an app stores only under a key it is handed or owns: storage-core types no key, no
  prefix and no event name. Each app's keys come from its application-data package; a generic
  package takes its key from the app (RULE-STD-FRONTEND-010, RULE-STD-ARCH-201).
- This is the one place in the packages that touches `localStorage` or `sessionStorage`. The
  boundary suite runs repo-guards' browser-storage guard over every package with this package's
  guarded functions as its one reviewed site, so any other package code that reaches either storage
  fails the gate. Each app's guard suite holds its own code to the same helper.
- A package that stores something declares storage-core an optional peer, never a dependency, so
  the app installs the one copy that holds every held value, and a version two packages disagree on
  fails the install instead of nesting a second copy with its own held values.
