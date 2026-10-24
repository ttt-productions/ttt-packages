# Adopt @ttt-productions/repo-guards 0.1.22

**What:** Three new guards: no blanket cast, no end-to-end retry loop that acts, no swallowed end-to-end action.
**Severity:** high
**Came from:** the ttt-prod shared-standards Phase 3 repair session (third package release)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.22.
- **Release:** `./scripts/release-multiple.sh audit-core chat-react chat-schemas dev-standards firebase-helpers media-processing-core media-viewer moderation-core monitoring-core notification-core q-core rate-limit-core repo-guards report-core ttt-core ui-core upload-ui patch`.
- **What changed:** New generic guards, each with anchored reviewed exceptions (`{ path, anchor, why }` — an entry excuses the one occurrence whose source holds its anchor): `blanketCasts` ("no cast switches type checking off": no `as never` / `as unknown as X` in any code, tests included); `retryLoopActions` ("no end-to-end retry loop repeats a user action": no click, input, reload, or navigation inside `toPass()` / `expect.poll()`); `swallowedE2eActions` ("no end-to-end action or state read swallows its failure": no `.catch()` or try/catch on an action or on `isVisible()` / `isEnabled()` / `isChecked()`). The two e2e guards take `actionHelpers` (the app's own action helper names) and may be `{ absent: why }` only with no e2e root. The suite now hands guard facts through `ConfiguredGuardDefinition`, so a test passes deliberately bad facts with no cast.
- **What the app must change:** Install. Add `blanketCasts: { reviewed: [] }`, `retryLoopActions: { actionHelpers, reviewed: [] }` and `swallowedE2eActions: { actionHelpers, reviewed: [] }` to the guard config. Fix every finding at its root (a typed fake or builder, a narrow port type, an outcome-verified helper, one action and one assertion); an exception is an anchored entry only where there is no other way, on DJ's yes, with its why.
- **Done when:** The lockfiles name 0.1.22 or later and the guard suite passes all three guards.
