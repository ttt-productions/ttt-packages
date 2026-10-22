---
name: chatgpt-recheck-fixes
description: ChatGPT/Codex workflow (Recheck fixes). Use when fixes have landed and DJ wants each one checked against the current source — fixed, partly fixed, or still open.
---

# Recheck fixes

**AI:** ChatGPT/Codex
**Jobs:** Recheck fixes
**Use it when:** fixes have landed and DJ wants each one checked against the current source — fixed, partly fixed, or still open.
**Kickoff:** `Run the <APP_NAME> development workflow chatgpt/recheck-fixes for <items, a raw-findings run, or a project step>.`
**Reads from / writes to:** reads `<APP_NAME>` source and the named `docs/work/` items or run; writes ONLY rechecks into those items or that run, and new findings into `docs/work/raw-findings/recheck-<short-slug>/`.

## Boundaries

Static, source-only recheck. Never run tests, builds, scripts, emulators, browsers, or services;
never edit app, package, test, rule, or design files; never use Git status, diffs, or history to find
what changed — read the current files the item names. "Source rechecked" never means runtime verified.

## Method

1. The normal preflight, then the routed rules and design docs for each item's area.
2. For each item: read the exact owner and symbols it names, follow the fix through its callers and
   consumers, and check the regression test proves the business rule rather than the code's current
   output (RULE-STD-QUALITY-001).
3. Record, on the item itself (or its raw entry), one verdict with evidence:
   - **Fixed** — the desired behavior holds at every named owner and consumer.
   - **Partly fixed** — what holds, what does not, where.
   - **Still open** — what the source still does.
   - **Superseded** — the code moved on; what replaced it.
4. A new problem the fix introduced is a new finding in `raw-findings/recheck-<short-slug>/`, never
   folded silently into the old item.

Up to three bounded read-only agents on the HIGH tier's ChatGPT/Codex cell may split a large
recheck, each with its exact read-before-acting paths (RULE-STD-ENG-010).

Finish with one short message: counts per verdict and where each verdict is recorded. Deleting a
fixed item is part of implementation's definition of done, not this workflow's — DJ decides.
