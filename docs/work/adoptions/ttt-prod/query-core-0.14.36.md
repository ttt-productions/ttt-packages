# Adopt @ttt-productions/query-core 0.14.36

**What:** `createAppConfig` no longer has refused levers: a stored app-config value that does not match the app's schema makes the config unavailable and is reported, never read as a default.
**Severity:** medium

**Outdated design.** This release still reads a missing setting as its default, and reports a failed read and an unreadable document as one `unavailable` state. The agreed design replaces both: no setting has a default anywhere, and `createAppConfig` hands out no settings before the document is read and reports a failed read and a missing or invalid document apart. A later query-core release changes it. Take the install from this file, and build nothing on a default.

- **Package and version:** `@ttt-productions/query-core` 0.14.36.
- **Release:** `./scripts/release-multiple.sh query-core q-core patch`.
- **What changed:** `AppConfigDefinition` drops `isLeverRefused` and `onLeverRefused`, and the state
  drops `refusedLevers`. `readLevers(stored)` reads each lever as stored (its default only when the
  field is absent) and throws when a stored value does not match the schema; a throw makes the
  config `unavailable` and goes to the new optional `onUnreadable(error)`.
- **What the app must change:** ttt-prod's `src/components/app-config-provider.tsx` passes
  `isLeverRefused` and `onLeverRefused`, so it does not build on this version until they are
  removed. Adopt it together with
  `docs/work/waiting-to-be-implemented/app-config-guard-removed.md`, which takes the same guard out
  of ttt-core and ttt-prod.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.36 or later, and that item
  is done.
