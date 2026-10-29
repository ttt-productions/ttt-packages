# Adopt @ttt-productions/file-input 0.11.20

**What:** The record dialog no longer writes its temporary `record_dialog_*` console diagnostics.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/file-input` 0.11.20.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ui-core ttt-core file-input firebase-helpers query-core patch`.
- **What changed:**
  - `RecordDialog` writes no `record_dialog_*` `console.debug` lines; the Firefox failure they diagnosed did not reproduce in 49 recordings, and the dialog's behavior is unchanged.
- **What the app must change:** Install. If the app's hosted end-to-end suite captures `record_dialog_*` console lines (a watchdog prefix, a diagnostics file), remove that capture; a Start helper that clicks again while Stop is absent can become a single click.
- **Done when:** The lockfiles name `@ttt-productions/file-input` 0.11.20 or later, no `record_dialog_` capture remains, and the gate is green.
