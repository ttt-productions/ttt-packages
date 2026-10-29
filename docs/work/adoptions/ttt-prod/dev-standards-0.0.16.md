# Adopt @ttt-productions/dev-standards 0.0.16

**What:** RULE-STD-FRONTEND-007 names theme-core's truncation classes as the one truncation owner.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.16.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards theme-core patch`.
- **What changed:** RULE-STD-FRONTEND-007 says titles and names render through theme-core's `.single-line-truncate` and a few-line text block through its `.three-line-clamp`, and prohibits an app's own copy of them. The codebase-hygiene playbook's UI-consistency step runs the truncation guard and checks the same. No rule ID changed.
- **What the app must change:** the install, at the root and in `functions`; the class move is the theme-core 0.12.16 adoption.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.16 or later.
