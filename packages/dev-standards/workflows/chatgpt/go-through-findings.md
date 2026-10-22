---
name: chatgpt-go-through-findings
description: ChatGPT/Codex workflow (Decide findings). Use when raw findings exist and DJ wants to decide them, one at a time, into work.
---

# Go through findings with DJ

**AI:** ChatGPT/Codex
**Jobs:** Decide findings
**Use it when:** raw findings exist and DJ wants to decide them, one at a time, into work.
**Kickoff:** `Run the <APP_NAME> development workflow chatgpt/go-through-findings[ for <raw-findings run>].`
**Reads from / writes to:** reads `docs/work/raw-findings/` and `docs/work/needs-decision/`; writes `docs/work/` items (all folders) and annotations in the raw-findings run it is working.

This is a decision conversation, not an investigation sweep and not implementation. It never starts
agents automatically, never changes code, and never treats an agent recommendation, a doc label, or
silence as DJ's approval.

## Startup

1. The normal preflight: `CLAUDE.md`, `AGENTS.md`, the shared `<DEV_STANDARDS>/rules/README.md` and
   `core-rules.md`, the app's own `<APP_RULES>README.md` and `core-rules.md`, and the routed rules for
   each finding's area as it comes up.
2. Read `<DEV_STANDARDS>/work/README.md`, the named raw-findings run (or list the runs and ask
   which), and `docs/work/needs-decision/`.
3. Build a deduplicated queue: merge repeated instances of the same root cause and owner into one
   situation, keeping every contributing raw entry linked. Check `waiting-to-be-implemented/`,
   `do-later/`, and project steps first — a finding already held there strengthens that item instead
   of becoming a duplicate.

## One situation at a time

Before presenting, establish what the current code actually does from the saved evidence, or a
focused source check when the evidence is missing, stale, or disputed. Never ask DJ to choose on an
unverified agent summary. Then present, in plain language:

> `<APP_NAME>` currently does A. This causes or risks B. The applicable rule or design says C. I
> recommend D because E. Do you want D, another option, to park it, or to drop it?

Show every user-visible effect of the proposed fix. Bring EVERY proposed task to DJ, including
obvious rule-compliance fixes. Present one, wait for DJ's answer, and do not move on while he is
still discussing it. A response that discusses, challenges, or asks for research is not a choice.

When DJ questions a finding: keep it undecided, follow the disputed assumption through the source
(or, only if DJ asks, one bounded read-only agent), correct or withdraw unsupported claims, append
the correction to the raw entry without erasing the original, and present the revised situation.

## Recording DJ's answer

Every answer is written to `docs/work/` the same session, in the item format of
`<DEV_STANDARDS>/work/README.md`:

- **Do it** → one `waiting-to-be-implemented/` item with the desired final behavior, exact owner and
  symbols, scope exclusions, shared-package dependency, data migration needs, affected tests and
  docs, and how to prove it is done. Several approved tasks that must ship together become one
  item that names each task. Package-side work is listed first and marked packages-first.
- **Park it** → a `do-later/` item with its trigger.
- **Needs more thought / waiting on something only DJ can settle** → a `needs-decision/` item.
- **Drop it** → annotated as dropped in the raw entry; no item.

Mark each raw entry with its outcome. When nothing in the run is still undecided, the run folder is
deleted (`<DEV_STANDARDS>/work/README.md`).

## Stopping

Stop when DJ says so or the queue is empty. Hand off: what was decided, which items were written
where, and what is still undecided. Implementing the decided items is a Claude workflow, started
separately by DJ.
