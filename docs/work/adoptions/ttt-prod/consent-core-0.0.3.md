# Adopt @ttt-productions/consent-core 0.0.3

**What:** The cookie banner clears a phone's home indicator and fades in on the motion tokens.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity Foundations)

- **Package and version:** `@ttt-productions/consent-core` 0.0.3.
- **Release:** `./scripts/release-multiple.sh consent-core patch`.
- **What changed:** `CookieConsentBanner`'s bar pads its bottom edge by `max(1rem, env(safe-area-inset-bottom))`, so its buttons clear the home indicator on a page drawn under it (ttt-prod's layout sets `viewportFit: 'cover'`), and it fades in with an opacity transition on `--motion-base` / `--motion-ease` (Tailwind's `starting:` variant), stopped by `prefers-reduced-motion` and by the app's reduced-motion switch. No API change. Design: ttt-packages `docs/packages/consent-core.md` § Controls.
- **What the app must change:** Install. The app stylesheet's `@source` line for consent-core already makes Tailwind generate the new classes.
- **Done when:** The lockfiles name `@ttt-productions/consent-core` 0.0.3 or later.
