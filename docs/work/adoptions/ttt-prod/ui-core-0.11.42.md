# Adopt @ttt-productions/ui-core 0.11.42

**What:** ui-core gains a themed `QrCode` component.
**Severity:** low
**Came from:** the Q-Sports QR invite build ttt-packages session

- **Package and version:** `@ttt-productions/ui-core` 0.11.42.
- **Release:** `./scripts/release-multiple.sh short-link-core ui-core q-core patch`.
- **What changed:** `QrCode({ value, label, className })` from `@ttt-productions/ui-core/react` draws
  a QR code as an inline SVG through the `uqr` encoder, with a four-module quiet zone, dark modules on
  a light ground (`--neutral-black` on `--neutral-white`) in every theme, named by `label`. It is
  ttt-prod's step-up `EnrollmentQrCode` moved into the package (`docs/packages/ui-core.md` § QR code).
- **What the app must change:** Install. Moving the step-up dialog onto `QrCode` is part of
  `docs/work/waiting-to-be-implemented/short-links-and-step-up-qr-on-the-packages.md`.
- **Done when:** The lockfiles name `@ttt-productions/ui-core` 0.11.42 or later.
