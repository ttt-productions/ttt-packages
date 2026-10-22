---
name: claude-fix-known-errors-inline
description: Claude Code workflow (Build or fix). Use when DJ wants known, decided problems fixed directly in this conversation.
---

# Fix known errors inline

**AI:** Claude Code
**Jobs:** Build or fix
**Use it when:** DJ wants known, decided problems fixed directly in this conversation.
**Kickoff:** `Run the <APP_NAME> development workflow claude/fix-known-errors-inline[: <items or errors>].`
**Reads from / writes to:** reads the named `docs/work/waiting-to-be-implemented/` items (or the errors DJ names); writes code, tests, the docs the fix touches, and `docs/work/`.

## Startup

1. The normal preflight, plus the routed rules and `docs/design/*.md` for every item's area.
2. Take the items DJ named, or list `docs/work/waiting-to-be-implemented/` and ask which.
3. Re-verify each item against the current code before touching it — line numbers drift; a fact that
   no longer holds is corrected in the item or brought to DJ, never implemented on trust.

## Working

- Fix inline, in this session, one item at a time.
- A needed `@ttt-productions/*` change: ALL package work first, then the release command, per the
  Normal `<APP_NAME>` Dev Flow (`<DEV_STANDARDS>/claude/CLAUDE.base.md`).
- Every fix ships a regression test that fails before the fix and proves the business rule
  (RULE-STD-QUALITY-001). Design docs the fix changes are updated in the same change.
- A large mechanical change found along the way → `mechanical-fan-out.md`, which asks DJ first.

## Finishing

The Normal `<APP_NAME>` Test Flow, once, on the whole change set. Then delete each finished item from
`docs/work/waiting-to-be-implemented/` and stop for DJ's push.
