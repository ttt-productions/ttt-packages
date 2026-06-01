# Design

Cross-cutting design rules and architectural invariants that govern how `@ttt-productions/*` packages are built and consumed. Each rule is small, scoped, and tells future sessions what to do and what NOT to do.

## How to use this folder

- One rule per file. Filename is the rule, kebab-case.
- Each rule follows the shape: **Rule** / **Why** / **Where it applies** / **What it forbids** / **When to revisit**.
- If a rule grows past ~300 lines, split it. If two rules are tightly coupled, keep them in one file with H2 sections.
- These docs are the source of truth for cross-cutting rules. `CLAUDE.md` may carry one-line pointers, but the prose lives here.
- Per-feature design (e.g. how `chat-core` resolves names, how `report-core` priority scoring works) goes in the relevant `docs/packages/<name>.md`, not here.

## Current rules

- `react-safety.md` — Main entry must be server-safe; React UI behind `./react`; admin-SDK code behind `./server`.
- `display-identity-invariant.md` — Cross-boundary types use uid-only references; apps resolve display names from their own identity source.
- `upload-path-invariant.md` — Every Firebase Storage upload uses the canonical `uploads/{fileOrigin}/{uid}/{pendingMediaDocId}` shape.

## Realm / Work discovery packages

Shared contracts for Realm/discovery belong in `docs/packages/ttt-core.md`; generic query mechanics belong in `docs/packages/query-core.md`. Do not create TTT-specific search presets inside generic packages.
