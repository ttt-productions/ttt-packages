# Adopt @ttt-productions/dev-standards 0.0.4

**What:** How an AI works with DJ: conversation modes, questions, git, prompts, exceptions, scratch files, adoption files, release versions.
**Severity:** medium
**Came from:** the ttt-packages AI-docs cleanup session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.4.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:**
  - `development-preferences.md`:
    - every conversation is inline unless DJ calls it an orchestrator, with what each mode does;
    - DJ's rules live only in his rule docs, there are no handoff docs, and an in-conversation instruction ends with the conversation;
    - every question is tracked until DJ answers it, and no Normal Test Flow runs while one is open;
    - no git action without DJ's command, and no git or GitHub read unless he says it is needed;
    - no exception without DJ's yes, each carrying its reason at the exception;
    - working files go in `C:\DjDev\claude-scratchpad\<date>-<topic>\`.
  - `claude/CLAUDE.base.md`:
    - an orchestrator's Test Flow is run by one test agent;
    - adoption files are written only for apps outside the conversation;
    - the release command names the versions it publishes, and polling waits for exactly those.
  - The Claude workflows and `model-tiers.md` follow the modes.
  - RULE-STD-QUALITY-006, -007 and -009 allow an exception only when no fix works, on DJ's yes.
- **What the app must change:** Install `@ttt-productions/dev-standards@latest` wherever it is declared. Q-Sports' own `docs/development-preferences.md`, `docs/development-workflows/`, `CLAUDE.md` Normal Flows and rulebook carry the older text until its migration moves it onto the shared docs.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.4 or later and the gate is green.
