# @ttt-productions/consent-core

Generic analytics / cookie consent: one opt-in choice per browser, applied in every open tab, with
analytics off until the visitor accepts.

## Owns

- The consent states, `'granted' | 'denied' | 'unset'` (`ConsentState`, `CONSENT_STATES`), and
  `parseStoredConsent` — the only stored values are `granted` and `denied`; anything else reads as
  `unset`.
- The consent store (`createConsentStore({ storageKey, changeEvent })`), built on theme-core's
  device-preference store (`createDevicePreferenceStore`): guarded storage that tolerates a browser
  that blocks site data, a same-tab change event, cross-tab sync through the `storage` event, and a
  stable `useSyncExternalStore` snapshot (RULE-STD-FRONTEND-010).
- `ConsentProvider` and `useConsent()` — `consent`, `analyticsEnabled` (`consent === 'granted'`),
  `ready` (false until hydration), `accept`, `decline`, `reopen`.
- The banner (`CookieConsentBanner`) and the reopen control (`CookieSettingsButton`).

## Entry points

- `.` — pure: the states and the parser. No React, no browser runtime.
- `./react` — the store, provider, hook, and the two controls (React, browser storage).

## Behaviour

- **Opt-in.** With no stored choice the state is `unset` and analytics is off; the banner shows
  while it is `unset` (after hydration).
- **The analytics switch.** `ConsentProvider` takes the app's `onAnalyticsChange(enabled)` and calls
  it whenever the stored choice changes: `true` for `granted`, `false` otherwise. It runs inside the
  store subscription, before the listener that re-renders consumers, so the render that shows the
  new choice already has analytics started or stopped — in the tab where the choice was made and in
  every other open tab. On mount it applies the stored choice once (a reload with consent granted).
  It is called only when the state actually changes; an unrelated `storage` event calls nothing.
- **Withdrawal is as easy as granting.** `reopen()` clears the stored choice, returning to `unset`
  (the banner shows again) with analytics off.
- **Fail-safe.** `useConsent()` outside its provider returns `unset`, analytics off, `ready: false`,
  and actions that do nothing. It never throws.
- **Controls.** `CookieConsentBanner({ copy })` renders the app's `regionLabel`, `message` (any
  content — the app puts its privacy-page link in it), `acceptLabel`, and `declineLabel`, in a bar
  along the bottom of the viewport, never a modal. The bar pads its bottom edge by the safe area, so
  its buttons clear a phone's home indicator on a page drawn under it (`viewport-fit=cover`), and it
  fades in on theme-core's motion tokens, which an app's reduced-motion switch and
  `prefers-reduced-motion` both stop.
  `CookieSettingsButton` is ui-core's `Button` (every `Button` prop but `onClick` and `type`) that
  calls `reopen`, always `type="button"`.

## Boundary

The app supplies its storage key and change-event name, its analytics on/off callback (for Firebase
Analytics, the handle in `firebase-helpers/client` — see `firebase-helpers.md`), all wording, and
where the banner and controls are placed. The package names no analytics vendor and holds no app
copy (RULE-STD-ARCH-201). `theme-core` and `ui-core` are optional peers used only by `./react`; an app
renders the banner's classes, so its stylesheet carries an `@source` line for this package
(RULE-STD-FRONTEND-002).
