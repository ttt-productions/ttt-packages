# Adopt @ttt-productions/ui-core 0.11.40

**What:** `ConsequenceDialog` can hold its confirm while something it depends on is unknown or failed.
**Severity:** low
**Came from:** the Q-Sports 2.0 shared-UI session (q-sports scope)

- **Package and version:** `@ttt-productions/ui-core` 0.11.40.
- **Release:** `./scripts/release-multiple.sh q-core ui-core patch`.
- **What changed:** Additive. `ConsequenceDialog` takes `confirmHeld` (a `ReactNode`). While it is set, the confirm is disabled, the caller's line saying why renders above the footer and is named by the confirm's `aria-describedby`, and a click never reaches `onConfirm`; Cancel stays available. Unset, `null` or `false` lifts the hold. Nothing existing changes.
- **What the app must change:** Install `@ttt-productions/ui-core@latest` wherever it is declared. Then look for a `ConsequenceDialog` that can already be open when a read its confirm depends on fails or goes unknown (for example a confirmation whose offer was decided from a roster or standing read that later fails): pass `confirmHeld` with the line saying why, through the read's held retry state, so the confirm waits as RULE-STD-FRONTEND-206 says. With no such dialog, the install is the whole adoption.
- **Done when:** The lockfiles name `@ttt-productions/ui-core` 0.11.40 or later, every such dialog holds its confirm, and the gate is green.
