# Adopt @ttt-productions/repo-guards 0.1.28

**What:** `readRetryState` catches two more ways a failure turns into a loading state under its retry; a new `firestoreClientWrites` guard.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.28.
- **Release:** `./scripts/release-multiple.sh query-core firebase-helpers repo-guards dev-standards patch`.
- **What changed:**
  - `generic.readRetryState` takes a new required fact, `controlPendingProp`: the prop a control shows its pending state through (ui-core's `Button` takes `pending`). The guard now flags a control's pending inside a failure branch that reads a fetching flag (`pending={read.isRefetching}` beside `read.isError`), and a branch that tests a read's live `isLoading` — read directly or through a destructured alias — ahead of that read's failure (`error`, `isError`, or `retryState`) later in the same function. A condition that also tests the read's failure passes.
  - New `generic.firestoreClientWrites` (`{ sanctioned: Reviewed[] }`): no app client source imports a Firestore write function (`setDoc`, `updateDoc`, `deleteDoc`, `addDoc`, `writeBatch`, `runTransaction`) from the Firestore SDK at runtime, or calls one through a namespace import. A sanctioned site is a reviewed entry with its why.
- **What the app must change:**
  - Add `controlPendingProp: 'pending'` to `generic.readRetryState` and `firestoreClientWrites: { sanctioned: [] }` to the generic guard config (or `false` with the absent reason if the app stores nothing in Firestore).
  - Fix every site the extended `readRetryState` reports: the surface decides failure first from the read's held `retryState`, then `retryState.isLoading`, and a failure control's pending is `retryState.isRetrying`. Fix or sanction every client write `firestoreClientWrites` reports.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.28 or later, the config declares both facts, and both guards are green.
