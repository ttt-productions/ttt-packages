---
name: claude-implement-an-approved-plan
description: Claude Code workflow (Build or fix). Use when a multi-task plan DJ approved (usually written by go-through-findings) is ready to build as one change set.
---

# Implement an approved plan

**AI:** Claude Code
**Jobs:** Build or fix
**Use it when:** a multi-task plan DJ approved (usually written by `go-through-findings`) is ready to build as one change set.
**Kickoff:** `Run the <APP_NAME> development workflow claude/implement-an-approved-plan: <the plan item>.`
**Reads from / writes to:** reads the named `docs/work/waiting-to-be-implemented/` plan item and everything it links; writes code, tests, the docs it touches, and `docs/work/`.

## Startup

1. The normal preflight, plus the routed rules and `docs/design/*.md` for every task's area.
2. Read the whole plan item and its linked raw evidence. The desired behavior DJ approved is fixed;
   the plan's implementation notes are a starting point.
3. Re-verify every task against the current code. A task that no longer matches the code, or that
   would need behavior DJ did not approve, goes back to DJ before any work on it.

## Building

- Packages-first: every package-side task in the plan lands, gates, and is released before any
  app-side task (Normal `<APP_NAME>` Dev Flow, `<DEV_STANDARDS>/claude/CLAUDE.base.md`).
- Build inline. Large mechanical parts → `mechanical-fan-out.md`; big parallel thinking work →
  propose `fan-out-implementation.md` to DJ.
- Approval covers exactly the approved tasks — no adjacent refactors.
- Every task ships its regression test (RULE-STD-QUALITY-001) and its doc updates.

## Finishing

The Normal `<APP_NAME>` Test Flow, once, on the whole change set. Delete the plan item once every
task is done and verified, then stop for DJ's push. A source recheck afterwards is the ChatGPT
`recheck-fixes` workflow, if DJ wants one.
