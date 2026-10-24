# Adopt @ttt-productions/repo-guards 0.1.21

**What:** A new line-ending guard, and the import-path package facts accept `{ absent: why }` in their declared types.
**Severity:** medium
**Came from:** the ttt-prod shared-standards Phase 3 repair session (second package release)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.21.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ttt-core patch`.
- **What changed:**
  - A new generic guard, `lineEndings` ("every text file is LF"), takes no facts. It fails when `.gitattributes` has no `* text=auto eol=lf` line, when `git ls-files --eol` reports any tracked file `w/crlf` or `w/mixed`, or when any file the guard reader reads under a declared root (untracked ones included) holds a CR line ending. Git for Windows ships `core.autocrlf=true`, which writes CRLF on every checkout unless `.gitattributes` pins `eol=lf`.
  - `packageEntries`, `packageImports`, `packageImportCycles`, `entryPurity`, and `applicationDataImports` are typed `Facts | Absent`, matching what the guards already accept at run time. Nothing changes at run time.
- **What the app must change:**
  1. Install `@ttt-productions/repo-guards@latest`.
  2. Set `.gitattributes` to `* text=auto eol=lf`.
  3. Add `lineEndings: {}` to the guard config's generic facts.
  4. Convert every file the guard names to LF (git stores them LF already, so the conversion shows no content diff).
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.21 or later, the guard config type-checks, and the guard suite passes `every text file is LF`.
