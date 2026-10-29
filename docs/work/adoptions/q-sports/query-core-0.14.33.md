# Adopt @ttt-productions/query-core 0.14.33

**What:** `CallablePolicy` gains a required slow-call notice, `onSlowCall`.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/query-core` 0.14.33.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ui-core ttt-core file-input firebase-helpers query-core patch`.
- **What changed:**
  - `createCallables(policy)`: `CallablePolicy.onSlowCall: { afterMs, show }` is required. Every callable call still pending after `afterMs` calls `show({ functionName })` once (while its session is current), and the dismiss function `show` returns runs when that call settles. New exported type `SlowCallNotice`.
- **What the app must change:** Add `onSlowCall` to the app's callable policy: its own `afterMs` and a `show` that raises the app's own "still working" surface (for example a toast) and returns its dismiss. ttt-prod uses 15 s and a toast.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.33 or later, the app policy carries `onSlowCall`, a test proves its notice, and the gate is green.
