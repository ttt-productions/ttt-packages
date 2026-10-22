---
name: claude-mechanical-fan-out
description: Claude Code building block, never offered on the menu. Called by an inline Claude workflow when it finds a large mechanical change to spread across LOW agents.
---

# Mechanical fan-out

**AI:** Claude Code
**Jobs:** none — called by other workflows, never offered on the menu
**Use it when:** never started on its own — an inline Claude workflow calls it when it finds a large mechanical change.
**Kickoff:** none; the calling workflow runs it.
**Reads from / writes to:** the calling workflow's item; the files the session assigns each agent.

A mechanical change applies a fixed set of written patterns to many files. Thinking work never goes
through this; it stays inline or goes to `fan-out-implementation.md`.

## Steps

1. **Ask DJ first.** The inline session (HIGH) proposes how many LOW agents to run; DJ approves
   that number, and nothing spawns without his yes. The session itself decides the files each agent
   owns (no file owned twice) and writes the example list — every pattern as an exact before →
   after — which goes to the agents, not to DJ for approval.
2. **Spawn the LOW agents** — the mechanical-only implementer of `<DEV_STANDARDS>/model-tiers.md`.
   Each prompt names: its owned files; the example list; its mandatory reading as explicit paths (the
   routed rule files and `docs/design/*.md` for its area — RULE-STD-ENG-010); that it may not spawn
   agents; that it runs only targeted tests on its own files; and the stop clause below.
3. **Stop clause.** Anything not on the example list, any needed `@ttt-productions/*` change, or
   anything unexpected → the agent stops and reports back to the HIGH session with what it found.
   It never guesses.
4. **The HIGH session handles every stop.** Usually it adds the new case to the example list and
   sends the agent back — and shows DJ each new example in chat as it adds it, so nothing is decided
   silently. It brings DJ only a genuine product or design call. A needed package change stops the
   whole fan-out: packages-first, per the Normal Dev Flow.
5. **One HIGH reviewer** checks all the agents' changes together once every agent is done: each
   change matches a listed pattern, nothing outside the patterns slipped in, and every new or changed
   test proves the business rule it claims, not the code's current output (RULE-STD-QUALITY-001).
6. **One final gate.** Back in the calling workflow: the Normal Test Flow once, for the whole change
   set. Its live stage belongs to ONE agent, never the orchestrating session.
