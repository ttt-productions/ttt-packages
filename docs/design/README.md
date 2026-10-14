# Design

Cross-cutting design rules and architectural invariants that govern how
`@ttt-productions/*` packages are built and consumed — the constraints that span
multiple packages rather than belonging to any single one. Per-package design
lives in `docs/packages/<name>.md`, not here.

## How to use this folder

- One rule per file, named for the rule in kebab-case.
- A rule states what it requires, why, where it applies, what it forbids, and
  when to revisit — as prose or H2 sections, whichever reads cleanly.
- If a rule outgrows a single focused file (~300 lines), split it; if two rules
  are inseparable, keep them in one file under H2 sections.
- These files are the source of truth for cross-cutting rules. `CLAUDE.md` and
  the package docs may carry one-line pointers, but the prose lives here.

## Where app discovery contracts belong

An app's discovery contracts (what it searches and how) belong in that app's
application-data package; generic query mechanics belong in `query-core`. Never
bake an app's collection names or search presets into a generic package.
