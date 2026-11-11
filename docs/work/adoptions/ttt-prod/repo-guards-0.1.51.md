# Adopt @ttt-productions/repo-guards 0.1.51

**What:** The quiet gate's live stages can wait until a service is ready, not just listening, with a ready check for the Functions emulator.
**Severity:** medium

- **Package and version:** `@ttt-productions/repo-guards` 0.1.51.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:** a `LiveService` may declare `ready`, which answers why it is not ready yet.
  Once every port listens, the stage waits up to its `readyWaitMs` (`READY_WAIT_MS` by default),
  asking every `READY_POLL_MS`, and fails in any run, naming each reason, when a service never
  answers ready. `functionsEmulatorReady({ port, functions })` is that check for the Functions
  emulator: ready once its `/backends` lists every function named. The Functions emulator opens its
  port before every codebase's triggers have loaded, so a live stage that starts right after a launch
  can lose the first trigger writes (a role-claims sync timing out in global setup was the
  sighting).
- **What the app must change:** ttt-prod's `scripts/test-quiet.mjs` `LIVE_STACK` checks only
  `auth (9099)`, `firestore (8080)` and `next (9002)`. Add the Functions emulator (its port from
  `firebase.json`) with `ready: functionsEmulatorReady({ port, functions })`, where `functions` is
  every export name in `functions/codebases.manifest.json`'s `codebases`.
- **Done when:** the lockfile names `@ttt-productions/repo-guards` 0.1.51 or later, and
  `npm run test:quiet:live` started right after a fresh `dev:e2e` launch waits for the Functions
  emulator's triggers before its first stage runs.
