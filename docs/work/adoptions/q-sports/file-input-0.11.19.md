# Adopt @ttt-productions/file-input 0.11.19

**What:** The record dialog holds its camera/microphone state as starting, ready, or failed, and temporarily logs each recording decision to the console.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (fourth package release)

- **Package and version:** `@ttt-productions/file-input` 0.11.19.
- **Release:** `./scripts/release-multiple.sh file-input repo-guards ttt-core patch`.
- **What changed:**
  - `RecordDialog` tracks its stream as acquiring, ready, or failed. Start starts disabled, stays disabled while the stream is acquiring (including when the dialog reopens), and enables once the stream is ready, or once acquisition failed with its error showing, so pressing Start retries it. The behavior a user sees is unchanged; the rule now holds by the dialog's own state rather than by render timing.
  - Temporary: the dialog writes one `console.debug` line per recording decision, prefixed `record_dialog_`, while a Firefox recording failure is diagnosed. It is removed in a later release once that failure is fixed.
- **What the app must change:** Install. Nothing else; an end-to-end console listener that fails on console errors is unaffected (the lines are debug level).
- **Done when:** The lockfiles name `@ttt-productions/file-input` 0.11.19 or later, and the gate is green.
