# Adopt @ttt-productions/repo-guards 0.1.53

**What:** The Firestore write guard resolves the documents a helper reads from a query it was given at each call site.
**Severity:** low
**Came from:** the Q-Sports triage-fixes ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.53.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:** a function whose every return is `<snapshot>.docs`, the snapshot being one
  local read of a query parameter (`transaction.get(query…)` or `query….get()`), now hands its
  documents back resolved from the query each call passes it. Before, a document from such a helper
  resolved from the pool of every caller's query, and failed as an unresolved target once more than
  the guard's candidate bound called it. A write through such a document that resolved before
  resolves the same now, to its own call site's collection.
- **What the app must change:** the install only.
- **Done when:** the lockfile names repo-guards 0.1.53 and the guard suite is green.
