# Adopt @ttt-productions/notification-core 0.15.27

**What:** The delivery ledger recognises an existing delivery row with firebase-helpers' one "already exists" predicate instead of its own copy.
**Severity:** low

- **Package and version:** `@ttt-productions/notification-core` 0.15.27.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** `createDeliveryLedger`'s `enqueue` treats a row that already exists as a
  per-row duplicate through `firebase-helpers`' `isAlreadyExistsError` (the numeric gRPC code, the
  string code `already-exists`, or the message form of an `Error`), and its private check goes. A
  rejection that is not an `Error` but carries an "already exists" message is no longer read as a
  duplicate; the Admin SDK always rejects with an `Error`. The ledger's server code now loads
  `firebase-helpers/server` at runtime, which the Functions runtime that uses it already installs.
- **What the app must change:** the install (with `@ttt-productions/firebase-helpers` 0.12.32 or
  later, which holds the predicate). ttt-prod's own already-exists helpers move onto
  `isAlreadyExistsError` from `@ttt-productions/firebase-helpers/server`.
- **Done when:** the lockfiles name `@ttt-productions/notification-core` 0.15.27 or later and
  ttt-prod's notification tests are green.
