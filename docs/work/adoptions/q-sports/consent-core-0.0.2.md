# Adopt @ttt-productions/consent-core 0.0.2

**What:** New package: generic analytics/cookie consent, one opt-in choice per browser, applied in every tab.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/consent-core` 0.0.2.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - New package `@ttt-productions/consent-core` (first release). `.`: `ConsentState`, `CONSENT_STATES`, `parseStoredConsent`. `./react`: `createConsentStore({ storageKey, changeEvent })` on theme-core's device-preference store, `ConsentProvider({ store, onAnalyticsChange })`, the fail-safe `useConsent()`, `CookieConsentBanner({ copy })` and `CookieSettingsButton`.
  - `theme-core` and `ui-core` are optional peers used by `./react`; the banner's classes need an `@source` line for the package in the app's stylesheet. Design: ttt-packages `docs/packages/consent-core.md`.
- **What the app must change:** Install it where the app renders consent. Where Q-Sports has its own consent store, banner or reopen control, replace them with this package (its storage key and change event from `q-core`, its analytics switch wired to `onAnalyticsChange`, its wording passed in) and delete the local copies; where it has none yet, it builds its consent on this package when it adds analytics.
- **Done when:** The lockfiles name `@ttt-productions/consent-core` 0.0.2 or later and no app-local consent store remains, and the gate is green.
