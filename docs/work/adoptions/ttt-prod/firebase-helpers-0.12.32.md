# Adopt @ttt-productions/firebase-helpers 0.12.32

**What:** The server Firestore contract gains the four members the shared sweeps and account repair need, and the server entry gains the one "already exists" predicate.
**Severity:** medium

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.32.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed** (on `./server`):
  - Types only: `ServerFirestore.getAll(...refs)`, the field-value form
    `ServerQuery.startAfter(...fieldValues)`, `ServerDocSnapshot.updateTime`, and the
    `lastUpdateTime` precondition on `ServerDocRef.delete`, with the `ServerUpdateTime` type they
    share (`toMillis()` and the exact comparison `isEqual(other)`). The Admin SDK's own types and the in-memory test kit already satisfy them.
  - `isAlreadyExistsError(error)`, the one "already exists" predicate: a Firestore refusal of a
    create whose document already exists, recognised by the numeric gRPC code (6), the string code
    `already-exists`, or the message form.
- **What the app must change:**
  - The install.
  - ttt-prod's own helper, `functions/src/shared/already-exists.ts` (`isAlreadyExistsError`, with
    `grpc-status.ts` if nothing else uses it), goes; every caller imports `isAlreadyExistsError`
    from `@ttt-productions/firebase-helpers/server`. Any other private already-exists check in
    ttt-prod's code moves onto it too.
  - Every hand-built fake or adapter of the contract in ttt-prod's code or tests (one written by
    hand rather than the kit or the Admin SDK itself):
    - a `ServerFirestore` fake or adapter must gain `getAll` (a fake whose test never reads several
      documents gives it the same thrower it gives its other unused members);
    - a `ServerDocRef` fake may need `delete`'s `lastUpdateTime` precondition, and a `ServerQuery`
      fake the field-value form of `startAfter`, wherever the code under test uses them;
    - a `ServerDocSnapshot` fake may carry `updateTime`; a fake update time needs both `toMillis()`
      and `isEqual(other)`.
- **Done when:** the lockfiles name `@ttt-productions/firebase-helpers` 0.12.32 or later, no code in
  ttt-prod keeps its own already-exists check, and the Functions typecheck is green.
