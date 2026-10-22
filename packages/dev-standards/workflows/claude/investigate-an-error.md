---
name: claude-investigate-an-error
description: Claude Code workflow (Investigate an error). Use when DJ wants Claude to find the root cause of an error and write up the fix, without fixing it yet.
---

# Investigate an error

**AI:** Claude Code
**Jobs:** Investigate an error
**Use it when:** DJ wants Claude to find the root cause of an error and write up the fix, without fixing it yet.
**Kickoff:** `Run the <APP_NAME> development workflow claude/investigate-an-error: <the error, pasted or described>.`
**Reads from / writes to:** reads `<APP_NAME>` source, tests, and `docs/work/`; writes ONLY `docs/work/raw-findings/error-<short-slug>/report.md`.

## Boundaries

- No code, test, rule, or design edits. Focused local tests may be run to reproduce (a single-file
  `npx vitest run <file>`); never the live stack unless DJ says so.
- Hosted dev, production, Sentry, logs, or cloud state only when DJ grants that access in this
  conversation; otherwise work from the pasted error and the local code.
- Direct reads; no agents unless DJ approves them.

## Method

1. The normal preflight, then the routed rules and `docs/design/*.md` for the area the error touches.
2. Search `docs/work/` first — an item or earlier run on the same error is extended, not duplicated.
3. Get the REAL error first, then trace it: the failing frame or assertion → the owning code → its
   callers, data, rules, and shared-package owner. Never guess-loop.
4. Classify: real defect, test-code defect, flake (a flake is a real bug — find why), expected
   behavior reported as an error, or a design question for DJ.

## The write-up

The report holds: the error and how it reproduces; the root cause with exact file, symbol, and
lines; who is affected; the classification and confidence; the smallest correct fix and its owner
(app, `<APP_DATA_PACKAGE>`, or a generic package) with any packages-first or migration consequence;
the regression test that would have caught it; and any question for DJ with a recommendation.

Finish with one short message: the root cause, the recommended fix, the report path. DJ decides
whether `fix-known-errors-inline` picks it up.
