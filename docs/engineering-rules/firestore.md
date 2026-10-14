# Firestore in packages (BACKEND)

Rules for a package that reads or writes Firestore, runs a transaction or batch, or builds a write
guard. Format and IDs: [README.md](README.md).

### BACKEND-101 — All transaction reads before all transaction writes

**Rule.** A transaction body runs in fixed order: all reads, then the throw-points those reads
trigger, then all writes. A read of a document one of your own earlier writes affects means the
function is really two transactions — restructure it.

**Why.** Firestore throws at runtime on any read after a write inside a transaction.

**Prohibits.**
- Any `transaction.get` after a `set` / `update` / `delete` in the same transaction.

**References.** BACKEND-116.

### BACKEND-104 — Dotted paths only in update(); nested objects in merge-sets

**Rule.** Dot notation is a field path ONLY in `update()`. In a merge-set a dotted key creates a
LITERAL top-level field; pass a real nested object instead. Firestore test mocks expand dotted keys
ONLY in a mocked `update()`.

**Why.** A dotted key in a merge-set writes a literal field while the write reports success.

**Prohibits.**
- Dotted string keys inside a merge-set.
- A test mock that expands dotted keys for merge-sets.

**References.** QUALITY-001.

### BACKEND-116 — Every write precondition is decided inside the write's transaction

**Rule.** A precondition a write depends on — a lock or status, a cap or count, an existence or
duplicate check, a membership — is read inside the same transaction as the write, through that
transaction, and a read that errors fails CLOSED. A cap or uniqueness decided by counting a query
also writes one document every competing writer writes, so racers conflict instead of both passing.
A partial edit writes only the fields its user changed.

**Why.** A precondition read outside the transaction is a time-of-check/time-of-use hole; a resent
snapshot silently overwrites a concurrent edit.

**Prohibits.**
- A plain read deciding a transactional write; a precondition read that fails open.
- A cap or uniqueness proven only by a query count with no document both racers write.
- Resending untouched fields from a loaded snapshot.

**References.** BACKEND-101.
