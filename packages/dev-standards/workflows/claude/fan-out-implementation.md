---
name: claude-fan-out-implementation
description: Claude Code workflow (Build or fix). Use when the work is big enough that several implementation agents should build it in parallel.
---

# Fan-out implementation

**AI:** Claude Code
**Jobs:** Build or fix
**Use it when:** the work is big enough that several implementation agents should build it in parallel.
**Kickoff:** `Run the <APP_NAME> development workflow claude/fan-out-implementation: <the item, plan, or step>.`
**Reads from / writes to:** reads the named `docs/work/` item, plan, or step; writes code, tests, docs, and an orchestration ledger beside the work it tracks (deleted when the work finishes).

## Before anything spawns

1. The normal preflight. This session saves its context for managing agents and does not read or
   edit code itself (`<DEV_STANDARDS>/development-preferences.md` § Agents).
2. Launch read-only agents to read the routed rules, the `docs/design/*.md` for every area involved,
   and the current code, and report the system back; the design each building agent gets comes from
   their reports.
3. Propose to DJ: the number of agents and each one's exact scope and owned files. Nothing spawns
   without DJ's yes.
4. App-side work: confirm every shared package it depends on is at `@latest` first. Package work and
   app work never run at the same time — all package work, its gate, and DJ's publish come first.

## Every spawned prompt

- The high-level picture and the design to build: build this, this way.
- The agent's exact scope and owned files, and its mandatory reading as explicit read-before-acting
  paths: the routed rule files (shared and the app's) and `docs/design/*.md` for its area
  (RULE-STD-ENG-010).
- A hard ban on spawning agents.
- A kill-and-escalate clause: a needed package change, a better or different way than the design,
  or anything unexpected → stop and report to this session.
- Targeted tests only, on its own work.
- Tier per `<DEV_STANDARDS>/model-tiers.md` (implementation agents; a mechanical-only part uses
  `mechanical-fan-out.md` instead).

## Review and gate

- Adversarial review agents at the HIGH tier over the landed work, each also checking every new or
  changed test against the business rule it claims to prove (RULE-STD-QUALITY-001; testing-coverage
  playbook).
- Exactly ONE final full gate after every agent has landed: the Normal `<APP_NAME>` Test Flow, run
  as `<DEV_STANDARDS>/claude/CLAUDE.base.md` § The Normal `<APP_NAME>` Flows says for an
  orchestrator.
- Delete the finished `docs/work/` items and the ledger, then stop for DJ's push.
