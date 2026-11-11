# Adopt @ttt-productions/repo-guards 0.1.46

**What:** The "one callable rejection surfaces exactly once" guard sees the answer predicate an app hook hands its declared hook.
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.46.
- **Release:** `./scripts/release-multiple.sh q-core repo-guards patch`.
- **What changed:**
  - `callableDoubleSurface`: when a call site uses an app hook built over a toasting declared hook,
    a local toast gated on a function the app hook's own `isAnswerSurfacedByCaller` predicate calls
    is no longer a second surface. An `isAnswerSurfacedByCaller` written as an inline arrow is read
    too (each call in its body), at the call site and inside the app hook. An ungated toast is
    flagged as before.
  - The frozen firestore test fixture drops its `membershipRosterSyncs` collection and the
    `teamRoster.syncRetried` audit type. Test-only.
- **What the app must change:** Install. A finding the guard reported only because it could not
  see an app hook's answer predicate disappears; a reviewed entry kept for one is now stale and
  goes.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.46 or later, and the guard
  suite's "one callable rejection surfaces exactly once" passes with no entry kept for that reason.
