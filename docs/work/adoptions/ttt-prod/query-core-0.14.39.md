# Adopt @ttt-productions/query-core 0.14.39

**What:** `createCallablePolicy`'s kit also answers what kind a failure is and which toast the policy would show for it, for a caller that handles its own failures.
**Severity:** low

- **Package and version:** `@ttt-productions/query-core` 0.14.39.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** the kit `createCallablePolicy(definition)` returns (`./react`) gains two
  members; nothing it already returned changes.
  - `callableFailureKind(error)` returns the kind the policy decides for a failed call, in its one
    order: `'connection-dropped'` (never sent, the token fetch's connection failed), `'not-sent'`
    (never sent, App Check throttled it or its token failed), `'token-refused'` (the platform
    refused the ID or App Check token), `'outcome-unknown'` (the deadline passed), `'maintenance'`,
    or `'other'`. Its type, `CallableFailureKind`, is exported from `./react`. The routing, the
    reporting, and `describeCallableError` read the same function.
  - `callableFailureToast(error)` returns the app's own toast that the routing would show for that
    failure, with its description resolved: the kind's wording slot, the maintenance slot with the
    operator's message, or the generic error slot described by `describeCallableError`. It shows
    nothing itself.
  - `CallablePolicyKit` now takes the app's toast type, `CallablePolicyKit<TToast>`, so
    `callableFailureToast` returns it. `createCallablePolicy` infers it from the definition, so a
    caller that never names `CallablePolicyKit` changes nothing.
- **What the app must change:** the install. ttt-prod has no caller that handles its own callable
  failures by deciding their kind or building the policy's toast, so nothing uses the two members
  yet. A ttt-prod surface that later shows its own callable failure takes its kind or its toast from
  these two members, never from its own checks.
- **Done when:** the lockfiles name `@ttt-productions/query-core` 0.14.39 or later, and the
  typechecks and ttt-prod's Normal Test Flow are green.
