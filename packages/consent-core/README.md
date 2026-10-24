# @ttt-productions/consent-core

Generic analytics / cookie consent: one opt-in choice per browser, applied in every open tab, with
analytics off until the visitor accepts.

- `.` — pure: the consent states and their parser.
- `./react` — `createConsentStore`, `ConsentProvider` / `useConsent`, `CookieConsentBanner`, and
  `CookieSettingsButton`.

The app supplies its storage key, change event, analytics on/off callback, and every word shown.
`@ttt-productions/theme-core` and `@ttt-productions/ui-core` are optional peers used by `./react`.
