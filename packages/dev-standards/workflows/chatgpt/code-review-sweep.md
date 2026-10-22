---
name: chatgpt-code-review-sweep
description: ChatGPT/Codex workflow (Find problems). Use when DJ wants an open-ended, read-only review of the product that keeps finding problems he has not thought of.
---

# Code review sweep

**AI:** ChatGPT/Codex
**Jobs:** Find problems
**Use it when:** DJ wants an open-ended, read-only review of `<APP_NAME>` that keeps finding problems he has not thought of.
**Kickoff:** `Run the <APP_NAME> development workflow chatgpt/code-review-sweep.`
**Reads from / writes to:** reads all of `<APP_NAME>` and `docs/work/`; writes ONLY inside `docs/work/raw-findings/code-review-sweep/`.

## Roles

The lead is this conversation; DJ picks its model. The lead keeps up to three investigative agents
active at a time, each on the HIGH tier's ChatGPT/Codex cell in `<DEV_STANDARDS>/model-tiers.md` at
high effort (a cell marked "not set" is a question for DJ before the first agent starts). When one
finishes, the lead reads its findings, updates the record, and starts another bounded investigation
so the three slots stay filled whenever possible. Agents never spawn agents.

The lead manages agents and curates their findings; it does not conduct an independent code review.
If evidence is incomplete, conflicting, or needs a source check, it sends an investigative agent to
resolve it.

## What to look for

DJ does not prescribe bugs or pick areas. Agents review a page, a function or pipeline, a shared
package, or a cross-cutting pattern; overlap is fine. The lead chooses worthwhile areas by risk and
reach while still exploring new parts of the codebase. Look for: correctness, user experience,
inconsistent interaction patterns, missing states or feedback, accessibility, security and
authorization, data ownership, duplicated implementations, hardcoded business values or CSS that
should use `<APP_DATA_PACKAGE>` or shared tokens/classes/components, reliability, test gaps, and
documentation or audit gaps. Prioritize meaningful failures and repeated patterns over cosmetic
comments.

## Boundaries

- Static source review only, for the lead and every agent: read local files and run read-only
  searches. Never run tests, lint, typecheck, builds, scripts, analyzers, emulators, browsers, or any
  local or hosted service.
- Do not change app, package, test, rule, playbook, or design files. Do not start a fix or deploy.
- `<APP_NAME>` scope only: `<APP_REPO>` and, when relevant, `<PACKAGES_REPO>`. Never inspect the
  other product's repository (the workspace router).
- Review current source files directly; never use Git status, diffs, commits, or history to
  discover changes. Never access hosted dev or production.
- Preserve all work in progress, including changes Claude or DJ make concurrently.
- Existing records in `docs/work/` (other raw-findings runs, needs-decision, waiting-to-be-implemented)
  are context to reconcile, never a reason to repeat or overwrite their investigations. Never modify
  another run's records.

## Reading

Before any delegation the lead personally reads `<APP_REPO>\CLAUDE.md`, `AGENTS.md`, the shared
rulebook's `<DEV_STANDARDS>/rules/README.md` and `core-rules.md`, the app's own `<APP_RULES>README.md`
and `core-rules.md`, `<DEV_STANDARDS>/playbooks/README.md`, and the routed rules needed to manage the
review. This preflight cannot be delegated.

For every system an agent examines, it reads the applicable area/topic rules (shared and the app's),
the relevant `docs\design\*.md`, and the relevant playbooks (the shared
`<DEV_STANDARDS>/playbooks/*-playbook.md`, the app's same-named additions, and the app's own
`docs\playbooks\*-playbook.md`) before the code. The lead names those exact paths in each agent
prompt as read-before-acting paths (RULE-STD-ENG-010); a general "follow the rules" is not enough. An
agent crossing into ttt-packages also reads its `CLAUDE.md`, `AGENTS.md`,
`docs\packages\package-architecture.md`, and the relevant package docs. If the reading list cannot be
identified, stop and ask DJ.

Agents use the rules and playbooks as evidence of the code ownership, standards, and patterns DJ
already knows to avoid — to find analogous bad code and important omissions in the rules or
playbooks themselves, not as a checklist. Playbook commands, scripts, tests, and browser procedures
are read-only context here; never execute them. Agents trace user actions and data flows across
frontend, backend, security rules, and shared packages when needed, verify claims from source, and
label static inferences honestly. Never call a bounded pass a full subsystem audit.

## The record

`docs/work/raw-findings/code-review-sweep/`: `README.md` is a short coverage and recheck ledger (what
was examined, by which pass, what needs a recheck); thematic findings live in `findings/*.md`. Read
it first; search it for an existing finding with the same underlying pattern and update that finding
instead of creating a duplicate. Keep every file under 500 lines; split a topic file before it grows
too long.

For each unique finding record: severity and confidence; the exact file, symbol, or line; the source
evidence and failure mode; the user or security impact; the smallest recommended fix and its owning
repository; what the implementer should verify; and whether an existing rule or playbook should have
caught it, needs correction, or needs a new step. Cite rule IDs. Separate source-supported defects,
static inferences, potential issues, and already-known work. Merge repeated instances into one
underlying pattern, especially where one shared component, `<APP_DATA_PACKAGE>` contract, constant,
or style token should replace local copies.

These are raw findings. Turning them into decided work is the `go-through-findings` workflow's job,
with DJ, one at a time — never this one.

## Running, pausing, stopping

Start by orienting to the local instructions, the existing record, and the repository layout, then
launch three bounded investigations promptly. Give concise progress updates. Do not pause after a
finding: keep spawning, reading, and updating the record until DJ says pause or stop. Surface a
critical security or data-loss finding to DJ immediately while the investigations continue.

- **Pause:** start no new agents, let running agents finish, record their findings, then stop.
- **Recheck request:** when DJ says fixes are ready, that is the `recheck-fixes` workflow.
