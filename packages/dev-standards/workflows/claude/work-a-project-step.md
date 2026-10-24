---
name: claude-work-a-project-step
description: Claude Code workflow (Build or fix). Use when DJ names a step of a project in docs/work/projects/ to work through.
---

# Work a project step

**AI:** Claude Code
**Jobs:** Build or fix
**Use it when:** DJ names a step of a project in `docs/work/projects/` to work through.
**Kickoff:** `Run the <APP_NAME> development workflow claude/work-a-project-step: <project> / <step>.`
**Reads from / writes to:** reads `docs/work/projects/<project>/PLAN.md` and the step's folder; writes code, tests, docs, the step's work doc, and `docs/work/`.

## The loop

1. Read the project's `PLAN.md`, find the step DJ named (or ask which), and read its folder. The work
   doc is the detail; the plan is only the map.
2. Read the step's mandatory reading — the routed engineering rules and design docs it names — then
   re-verify every item against the current code. A fact that no longer holds is corrected or
   reported, never implemented on trust.
3. Work the step, or one focused slice of it. A step with a publish stop: ALL its package work first,
   then the release command, per the Normal `<APP_NAME>` Dev Flow
   (`<DEV_STANDARDS>/claude/CLAUDE.base.md`).
4. A piece of the work agents would do better → propose LOW or HIGH agents for it to DJ, staying
   inline (`<DEV_STANDARDS>/development-preferences.md` § Agents); large mechanical parts use
   `mechanical-fan-out.md`.
5. The Normal `<APP_NAME>` Test Flow, once, on the change set.
6. Delete each finished item from the step's work doc. When the step is done, delete its folder and
   its section in `PLAN.md` — never renumber.
7. Continue with the next item, or stop when DJ says so; a new conversation resumes from the files.

`[OVERNIGHT-OK]` steps may relax the no-commit rule only per the protocol written in that step's
work doc.
