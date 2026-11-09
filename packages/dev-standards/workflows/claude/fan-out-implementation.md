---
name: claude-fan-out-implementation
description: Claude Code workflow (Build or fix). Use when the work is big enough that several implementation agents should build it in parallel, with this conversation directing and checking them.
---

# Fan-out implementation

**AI:** Claude Code
**Jobs:** Build or fix
**Use it when:** the work is big enough that several implementation agents should build it in parallel, with this conversation directing and checking them.
**Kickoff:** `Run the <APP_NAME> development workflow claude/fan-out-implementation: <the items, plan, or step>.`
**Reads from / writes to:** reads the named `docs/work/` items, plan, or step; writes code, tests, docs, and an orchestration ledger beside the work it tracks (deleted when the work finishes).

This session is the orchestrator of the work (`<DEV_STANDARDS>/development-preferences.md` § Agents).
It never edits code. It reads enough to tell each agent where its work goes and to check what comes
back; the agents build.

## Before anything spawns

1. The normal preflight, then every item in the work. Items that share files or depend on each other
   go in one wave; no file is owned twice.
2. For each wave, the session itself reads the routed rules (shared and the app's), the
   `docs/design/*.md` for the area, and the code each item names, and finds what already exists for
   the work: the owner in the packages, the owner in the app, and the guard that protects it. It
   reads one area at a time, never the whole system. Reading too wide for it to hold goes to
   read-only agents, which count against DJ's approval like any other; the session still opens every
   owner it names in a brief.
3. DJ's approval, in this conversation, in the form he chose: a budget the session works inside, or
   a yes for the wave with each agent's tier, exact scope, owned files, and brief shown first.
4. App-side work: confirm every shared package it depends on is at `@latest` first. Package work and
   app work never run at the same time — all package work, its gate, and DJ's publish come first.

## Every spawned prompt

- The high-level picture and the design to build: build this, this way.
- What already exists and must be used: each owner by path and name, and the guard that protects
  it. Extend this, here.
- The agent's exact scope and owned files, and its mandatory reading as explicit read-before-acting
  paths: the routed rule files (shared and the app's) and `docs/design/*.md` for its area
  (RULE-STD-ENG-010).
- A hard ban on spawning agents and on running any git or `gh` command.
- A kill-and-escalate clause: a needed package change, a better or different way than the design,
  an owner the brief did not name, or anything unexpected → stop and report to this session.
- Targeted tests only, on its own work.
- The report it sends back: each file, function, export, constant, and type it created and why no
  existing owner served; each decision it made that the brief did not; what it left undone.
- Tier per `<DEV_STANDARDS>/model-tiers.md` (implementation agents; a mechanical-only part uses
  `mechanical-fan-out.md` instead).

## Checking each report

A report is a set of claims. For every agent:

1. The code against the report, and against the item's own done-when.
2. Every new thing the report lists: the session looks for an existing owner of it in the packages
   and the app. One that exists, or that belongs in a package, goes back to the agent that built it,
   with the owner named.
3. A rule the work breaks goes back the same way, with the rule ID.
4. Every decision the agent made that DJ did not: asked of DJ, one at a time. While he is away, the
   question goes in chat and the session moves on to what does not depend on it.

## Review and gate

- Adversarial review agents over the landed work, at the HIGH tier unless DJ's approval names
  another, each also checking every new or changed test against the business rule it claims to prove
  (RULE-STD-QUALITY-001; testing-coverage playbook).
- Exactly ONE final full gate after every agent has landed: the Normal `<APP_NAME>` Test Flow, run
  as `<DEV_STANDARDS>/claude/CLAUDE.base.md` § The Normal `<APP_NAME>` Flows says for an
  orchestrator.
- Delete the finished `docs/work/` items and the ledger, then stop for DJ's push.
