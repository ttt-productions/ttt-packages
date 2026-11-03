# Adopt @ttt-productions/notification-core 0.15.24

**What:** notification-core exports `activityGenerationSchema`, the one schema for the activity generation it mints.
**Severity:** low
**Came from:** the Q-Sports data-rules ttt-packages session

- **Package and version:** `@ttt-productions/notification-core` 0.15.24.
- **Release:** `./scripts/release-multiple.sh notification-core firebase-helpers q-core dev-standards patch`.
- **What changed:** the root entry exports `activityGenerationSchema` (`z.uuid()`): the delivery
  ledger mints every activity generation as a random UUID, so a client that sends one back (an
  observed generation) is checked against that format rather than an open string.
- **What the app must change:** the install. Using it for ttt-core's `observedActivityGeneration`
  inputs is part of ttt-prod's item `docs/work/waiting-to-be-implemented/schema-bounds-from-named-constants.md`.
- **Done when:** the lockfiles name `@ttt-productions/notification-core` 0.15.24 or later.
