# Adopt @ttt-productions/repo-guards 0.1.39

**What:** The admin action surface can name the admin option's properties that widen it beyond the admin.
**Severity:** low
**Came from:** the Q-Sports 2.0 migration's admin move (ttt-parity 3b)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.39.
- **Release:** `./scripts/release-multiple.sh q-core repo-guards patch`.
- **What changed:** `adminActionSurface`'s `adminAuth` takes an optional `widenedBy` list: the admin option's own properties that admit a role beyond the admin. A callable whose admin option sets one of them (to anything but false, null, or undefined) is not admin-only, so it stays in the client's general declarations and its client callers are not admin reads. Without the list the guard reads exactly as before.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest`. Nothing else: ttt-prod's `allowJrAdmin` widens within admin standing, so ttt-prod sets no `widenedBy`.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.39 or later and the guard suite is green.
