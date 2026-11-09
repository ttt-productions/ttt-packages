# Adopt @ttt-productions/dev-standards 0.0.35

**What:** The orchestrator that spawns agents now reads enough to direct them and checks their reports for duplicates; agent approval, the new-conversation preference, and the builder tier are restated.
**Severity:** low
**Came from:** the ttt-packages session that rewrote the agent docs

- **Package and version:** `@ttt-productions/dev-standards` 0.0.35.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:** `development-preferences.md` § Agents (the orchestrator reads the rules, design
  docs and owning code; a brief names what already exists; a report lists what was created and is
  checked against the code; agents need DJ's approval in the conversation, as a budget or per wave)
  and § DJ decides (a new conversation, never a compacted one); `workflows/claude/fan-out-implementation.md`
  rewritten to that procedure; `workflows/claude/orchestrate-a-project.md` points to it for an
  orchestrator that spawns agents; `model-tiers.md` names the builder tier (HIGH) and no model
  outside its table.
- **What the app must change:** Install. Docs only; no code or config changes. The migration's
  orchestrator keeps running `orchestrate-a-project.md`, whose procedure is unchanged.
- **Done when:** the lockfiles name `@ttt-productions/dev-standards` 0.0.35 or later.
