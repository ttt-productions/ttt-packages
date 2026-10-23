# Adopt @ttt-productions/repo-guards 0.1.19

**What:** The admin-action guard reads the client's declarations and the admin area's modules; the read-state guard counts a read handed whole to a component.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run (found wiring the guards in ttt-prod)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.19.
- **Release:** `./scripts/release-multiple.sh report-core repo-guards ttt-core patch`.
- **What changed:**
  - `adminActionSurface` takes a required `clientDeclarations` fact, the app's full set of callable declarations. An admin-only callable the client declares outside `adminDeclarations` fails. An admin-only callable with no client declaration has no client caller and is left alone.
  - `adminActionSurface` treats an import of a module under an `adminAreaRoots` entry, from client code outside the area and the affordance owner, as an admin-hook import. Type-only imports pass. `adminHooks` stays for admin hooks that live outside the area.
  - `readStateBranches`: a hook-bound read passed whole as a JSX attribute value (`read={x}`) counts as reading its failure, so a surface that hands its read to a component that renders the failure passes the loading half.
- **What the app must change:**
  - Install `@ttt-productions/repo-guards@latest`.
  - Add `clientDeclarations` to the `adminActionSurface` facts (if the guard is wired rather than declared absent).
  - Drop any `readStateBranches` `loadingWithoutFailure` exception that covered a read passed whole as `read=`; the guard reports it stale.
- **Done when:** The lockfile names `@ttt-productions/repo-guards` 0.1.19 or later, and the guard suite runs green with no stale entry.
