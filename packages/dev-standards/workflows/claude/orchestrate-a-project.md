---
name: claude-orchestrate-a-project
description: Claude Code workflow (Build or fix). Use when DJ runs a large project across many conversations and wants one conversation to keep it on track.
---

# Orchestrate a project

**AI:** Claude Code
**Jobs:** Build or fix
**Use it when:** DJ runs a project in `docs/work/projects/` across many conversations and wants one conversation to plan the pieces, start them, and check what comes back.
**Kickoff:** `Run the <APP_NAME> development workflow claude/orchestrate-a-project: <project>.`
**Reads from / writes to:** reads the project's `PLAN.md`, its step folders, its ledger and any app workflow the project names; writes only the ledger, the project's docs, and `docs/work/`. Never writes app or package code.

A project with rules of its own (a migration, say) keeps them in an app workflow in
`<APP_WORKFLOWS>`; this doc is how any orchestrator runs, and that doc adds what only that project
needs. Where the two disagree, the project's doc wins for that project.

## What the orchestrator is

One conversation that keeps the whole project right while DJ works the pieces in conversations of
their own. It plans, starts, and checks. It never builds code and never designs: it carries DJ's
decisions to each piece as he made them and checks the work against them. It does help DJ plan —
the order of the pieces, what each covers, what is in the way — each with its recommendation.

## The ledger

`docs/work/projects/<project>/ORCHESTRATOR.md` holds only live state: where the project is, one row
per piece with its state, the open threads, and the next piece's `<PIECE>` text. It is the first
thing a new orchestrator reads, and it is deleted when the project finishes.

## Pieces

- **One purpose per piece.** A piece is design or implementation, and its `<PIECE>` says which. A
  design piece reads the code, settles the design with DJ, writes it into the item files, and changes
  no code. An implementation piece builds a design already settled.
- **Sized to finish.** A piece covers what one conversation can finish; never "do all items."
- **The brief holds only DJ's decisions.** The `<PIECE>` names the items it covers, how it fits the
  goal, and what done looks like. It never adds a requirement, a check, or a design, and never
  restates a rule the worker already reads.
- **Checked before it starts.** Every line the `<PIECE>` points to is read and checked against the
  plan and the step's work doc; a contradiction is fixed in the doc first, never passed on.
- **Started only on DJ's Go,** shown to him in full first, as a fresh conversation he works in. It is
  detached the moment it starts: the orchestrator never messages or reads it unless DJ says so.

## Checking a handoff

When DJ brings a piece's handoff:

1. The code against the handoff's claims — the files, the wiring, the focused tests, the lockfiles.
2. The code against what DJ decided, not only against the claims.
3. Every decision the worker made without DJ, every refusal, lock, limit or check that stops a person,
   and every task the handoff leaves for DJ: each asked of DJ, one at a time.
4. Found work filed where it belongs; finished items deleted; the ledger row updated.
5. The next `<PIECE>` drafted for DJ.

A worker's question or recommendation that DJ's docs already answer is named wrong, with the doc
line that answers it, never passed on as a real question.

## Pausing

When DJ says pause or stop, for any reason, a piece writes its status into the project's docs and
ends with one fenced HANDOFF block: everything done, everything left, every open question with a
recommendation, packages released and installed, and anything the next conversation needs. An
orchestrator that is handing over updates the ledger the same way.
