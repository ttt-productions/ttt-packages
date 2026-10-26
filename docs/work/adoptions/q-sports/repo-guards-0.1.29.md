# Adopt @ttt-productions/repo-guards 0.1.29

**What:** A `typedMocks` forbidden-override entry can name its shared fake's calls, so a fake that takes state arguments before its override object (an in-memory store) passes the check instead of reading as an override the guard cannot see.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.29.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:**
  - A `generic.typedMocks.forbiddenOverrides` entry takes an optional `fakeCalls` list: each `{ name, overridesArgument }` names a shared fake function and the position (1 or later, after `importOriginal`) of its override object.
  - For a call to a named fake, "no test overrides an export whose real behavior every test needs" reads only that argument. A missing one passes, an object literal is read name by name, and any other value fails as an override the guard cannot see. The arguments before it are the fake's state and are not read.
  - A call to a fake the entry does not name is read exactly as before: every argument but `importOriginal` must be an override object the guard can see.
  - The facts check fails a `fakeCalls` entry with no name, or with an `overridesArgument` that is not an integer of 1 or more.
- **What the app must change:** only the install. If the app wants a module listed under `forbiddenOverrides` whose shared fake takes state arguments (such as `firebase/firestore` mocked through an in-memory store fake), it can now list that module with `fakeCalls` naming the fake.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.29 or later and the guard suite is green.
