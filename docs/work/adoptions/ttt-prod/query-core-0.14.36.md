# Adopt @ttt-productions/query-core 0.14.36

**What:** `createAppConfig` no longer has refused levers: a stored app-config value that does not match the app's schema makes the config unavailable and is reported, never read as a default.
**Severity:** medium
**Came from:** the Q-Sports app-config guard removal ttt-packages session

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
