# Adopt @ttt-productions/dev-standards 0.0.17

**What:** RULE-STD-BACKEND-311 (Functions deploy groups) and the two-phase gate in the quality rules and the Test Flow.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.17.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards ui-core ttt-core file-input firebase-helpers query-core patch`.
- **What changed:**
  - New RULE-STD-BACKEND-311: no codebase over 55 functions, one codebase per deploy pass with a pause, receiving codebase first for a move.
  - RULE-STD-QUALITY-011 / -002: in an app the gate is `test:quiet` (start phase) then `test:quiet:live` (live phase); both green verify a change set. The shared Test Flow's stage 3 is `test:quiet:live`.
  - The codebase-hygiene playbook step 64 and the crosswalk name the new guard.
- **What the app must change:** Install, then follow the repo-guards 0.1.37 adoption (split, deploy passes, gate phases), and update the app's own docs that call `test:quiet` the full gate.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.17 or later and the app follows the two-phase gate.
