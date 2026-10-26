# Adopt @ttt-productions/firebase-helpers 0.12.20

**What:** The in-memory client Firestore reads a backtick-quoted field path, and its query log records each read's cursors.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.20.
- **Release:** `./scripts/release-multiple.sh query-core firebase-helpers repo-guards dev-standards patch`.
- **What changed (`./firestore-client/testing`):**
  - A filter or order on a field path whose segment is not a plain identifier (a map key with a dash, `members.user-a`, which the SDK backtick-quotes) matches as Firestore does; it matched nothing before.
  - Each entry of `queries()` carries `startAt` and `endAt`: the bound's `position` and whether it is `inclusive` (`startAt` / `endAt` are, `startAfter` / `endBefore` are not), `null` when the read has none. A test that compares a whole entry with `toEqual` gains the two fields.
- **What the app must change:** Install `@ttt-productions/firebase-helpers@latest` wherever it is declared; add `startAt: null, endAt: null` to any `toEqual` over a whole `queries()` entry.
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.20 or later and the gate is green.
