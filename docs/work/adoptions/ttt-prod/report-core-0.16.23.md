# Adopt @ttt-productions/report-core 0.16.23

**What:** The checkout task handlers take admin auth as optional, like checkin and release.
**Severity:** low
**Came from:** the ttt-packages shared-standards run (found wiring the admin-action guard in ttt-prod)

- **Package and version:** `@ttt-productions/report-core` 0.16.23.
- **Release:** `./scripts/release-multiple.sh report-core repo-guards ttt-core patch`.
- **What changed:** `auth` is optional on `createCheckoutTaskHandler` and `createCheckoutNextImportantHandler`. Without it, the handler makes no admin check of its own: the callable that builds it authorizes the caller first. With it, behavior is unchanged.
- **What the app must change:** Install `@ttt-productions/report-core@latest` wherever it is declared. A callable that already authorizes admin standing before building the handler drops the handler's `auth`; one that relies on the handler's check keeps it.
- **Done when:** The lockfiles name `@ttt-productions/report-core` 0.16.23 or later, each checkout callable checks admin standing exactly once, and the gate is green.
