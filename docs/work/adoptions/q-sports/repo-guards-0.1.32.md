# Adopt @ttt-productions/repo-guards 0.1.32

**What:** `firestoreTransactionReads` also inspects a `runTransaction` callback passed by name and every function with a required `Transaction` parameter.
**Severity:** medium
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.32.
- **Release:** `./scripts/release-multiple.sh ttt-core repo-guards patch`.
- **What changed:**
  - "a transaction callback reads only through its transaction" inspected only an inline `runTransaction` callback. It now also inspects (a) a callback passed to `runTransaction` by name and declared in the same file, and (b) every function whose `Transaction` parameter (`Transaction`, `FirebaseFirestore.Transaction`) is required. In each, a plain `ref.get()` / `query.get()` / `db.getAll(…)` not made through that transaction is a hit.
  - A function whose `Transaction` parameter is optional (`tx?: Transaction`, or one with a default) stays out: it reads plainly on purpose when called without one.
  - The guard takes no facts and no allowlist; nothing in the guard config changes.
- **What the app must change:** run the guard suite; every new hit is a write precondition read outside its transaction (RULE-STD-BACKEND-116) and is fixed by reading through the transaction parameter — a bounded query (`limit(…)`) where the read is a query — never by an allowlist entry or by making the parameter optional to step around the guard.
- **Done when:** the lockfiles name `@ttt-productions/repo-guards` 0.1.32 or later and the guard is green with no new exception.
