# Adopt @ttt-productions/firebase-helpers 0.12.22

**What:** The callable deadline (unknown-outcome) predicate is exported from the package root.
**Severity:** low
**Came from:** the ttt-packages callable-deadline session (ttt-prod scope)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.22.
- **Release:** `./scripts/release-multiple.sh firebase-helpers query-core ttt-core patch`.
- **What changed:** the root exports `isCallableDeadlineError(error)` and
  `CALLABLE_DEADLINE_EXCEEDED_CODE` (`'functions/deadline-exceeded'`), the one definition of the
  unknown-outcome class. It matches `callCallable`'s deadline error and the SDK's own timeout.
- **What the app must change:** the install. An app-side predicate or literal that tests for
  `'functions/deadline-exceeded'` imports `isCallableDeadlineError` instead (RULE-STD-FRONTEND-109:
  classification predicates come from firebase-helpers).
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.22 or later, no app
  code restates the deadline code, and the gate is green.
