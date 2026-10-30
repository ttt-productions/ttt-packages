# Adopt @ttt-productions/dev-standards 0.0.18

**What:** A question DJ answers by picking an option is his go to do what he picked.
**Severity:** low
**Came from:** a Q-Sports session (the 2.0 migration orchestrator)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.18.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:** `development-preferences.md` § Questions and gates: a question DJ answers by
  picking an option is his go to do what he picked, never a second "should I start?" question; an
  answer that is itself a question, "I'm not sure", "explain", or "talk to me" is not a go, and the
  session answers in plain words and starts nothing. It replaces "answering a question menu is not a
  start signal".
- **What the app must change:** Install only.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.18 or later.
