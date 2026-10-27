# Adopt @ttt-productions/repo-guards 0.1.31

**What:** `typedMocks` gains a third check: an export the app lists under `builtOverrides` may be replaced in a test only through one of its listed builders.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.31.
- **Release:** `./scripts/release-multiple.sh ttt-core repo-guards dev-standards patch`.
- **What changed:**
  - `generic.typedMocks` takes a required `builtOverrides` list. Each entry is `{ module, names, builders: { owner, names }, why }`: the mocked module (as the guard resolves it — a repo file such as `src/hooks/use-x.ts`, or a package specifier), the exports it holds, the file that owns the builders and their names, and why only the builders may stand in.
  - The new check, "an override of a listed export returns one of its listed builders", passes an override that is a function written at the override whose every return is a call to a listed builder (imported at the top of the file or inside the mock factory), or a holder — a name or property — that every assignment in the file sets from a listed builder. It fails a hand-written state, an unlisted builder, a stand-in that is no function written there, a holder nothing sets or one set to anything else, and an override object it cannot read. A builders owner that no longer exists fails too.
  - The facts check fails a missing `builtOverrides`, an entry with no module, names, builders owner, builders names, or why, and a module listed twice.
- **What the app must change:** declare `builtOverrides` in `generic.typedMocks` — `[]` when no export has shared builders, or an entry for each export whose stand-ins must come from the app's builders.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.31 or later, the guard config declares `builtOverrides`, and all three `typedMocks` checks are green.
