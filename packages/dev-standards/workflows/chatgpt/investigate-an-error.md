---
name: chatgpt-investigate-an-error
description: ChatGPT/Codex workflow (Investigate an error). Use when DJ has an error — a Sentry issue, a failing test, a bug report, a console error — and wants its root cause found and the fix written up, without any code change.
---

# Investigate an error

**AI:** ChatGPT/Codex
**Jobs:** Investigate an error
**Use it when:** DJ has an error — a Sentry issue, a failing test, a bug report, a console error — and wants its root cause found and the fix written up, without any code change.
**Kickoff:** `Run the <APP_NAME> development workflow chatgpt/investigate-an-error: <the error, pasted or described>.`
**Reads from / writes to:** reads `<APP_NAME>` source and `docs/work/`; writes ONLY `docs/work/raw-findings/error-<short-slug>/`.

## Boundaries

- Read-only investigation. Never edit app, package, test, rule, or design files; never run tests,
  builds, scripts, emulators, browsers, or services; never use Git history to discover changes.
- Hosted dev or production, Sentry, logs, or any cloud state only when DJ explicitly grants that
  access in this conversation; otherwise work from the pasted error and the local code.
- `<APP_NAME>` scope only (`<APP_REPO>`, and `<PACKAGES_REPO>` when the trace leads there).

## Method

1. The normal preflight (`CLAUDE.md`, `AGENTS.md`, the shared `<DEV_STANDARDS>/rules/README.md` and
   `core-rules.md`, the app's own `<APP_RULES>README.md` and `core-rules.md`), then the routed rules
   and `docs\design\*.md` for the area the error touches.
2. Search `docs/work/` first — a held item or an earlier run on the same error is context to extend,
   never to duplicate.
3. Trace from the error to its trigger: the stack frame or failing assertion → the owning code →
   its callers, data, rules, and shared-package owner. A grep hit is a locator, not proof.
4. Classify: real defect, test-code defect, infra/flake (a flake is still a real bug — find why),
   expected behavior reported as an error, or a design question for DJ.
5. Keep going until the root cause is source-supported, or state exactly what evidence is missing
   and how DJ can supply it.

Up to three bounded read-only investigative agents may be used when the trace genuinely splits, on
the HIGH tier's ChatGPT/Codex cell in `<DEV_STANDARDS>/model-tiers.md`, each prompt naming its exact
read-before-acting paths (RULE-STD-ENG-010). Agents never spawn agents.

## The write-up

`docs/work/raw-findings/error-<short-slug>/report.md`, written as evidence is found:

- The error as reported, and how it reproduces (or why it cannot be reproduced statically).
- The root cause with exact file, symbol, and lines; the failure mode; who is affected.
- The classification above, with confidence; static inference labelled as such.
- The smallest correct fix, its owning repository (app, `<APP_DATA_PACKAGE>`, or a generic package),
  and any packages-first or data-migration consequence.
- The regression test that would have caught it, and whether a rule or playbook should have caught it.
- Any design question for DJ, written as a question with a recommendation — never guessed.

Finish with one short message to DJ: the root cause, the recommended fix, and the report path.
Deciding the fix is the `go-through-findings` workflow; implementing it is a Claude workflow.
