# Codex instructions for ttt-packages

Read this repository's `CLAUDE.md` before reviewing, planning, editing, or running commands. The workspace-level `C:\DjDev\AGENTS.md` also applies.

## Mandatory reading protocol

- Engineering rules are ONE system for both repos and live in ttt-prod. Before reviewing, planning, designing, editing, or running implementation commands, read `C:\DjDev\ttt-master-app\docs\engineering-rules\README.md` and `docs\engineering-rules\core-rules.md` (the ten universal `ENG-*` rules), plus the routed area files per that README's routing table — `architecture/packages-and-boundaries.md` and the `quality/` rules apply to essentially every package task; add other areas the change touches.
- Read `docs/packages/package-architecture.md` in full and the relevant `docs/packages/*.md` ownership docs (and the cross-cutting `docs/design/*.md` invariants) before adding an import or export. Then inspect the current code — code is the implementation truth. This applies on every new package task; do not infer ownership from memory.
- Confirm dependency direction and the public entry-point boundary before adding an import or export. Main entries stay server-safe; React, browser, and Admin SDK code stay behind their canonical subpaths (ARCH-202).
- Implement shared behavior in the package that owns the concept; keep generic packages free of TTT identifiers, copy, paths, and policy (ARCH-201). Update the affected package design/ownership doc when behavior changes; do not create a new doc unless the user asks.
- Any prompt that spawns an implementation, design, or review agent names that agent's mandatory reading as explicit paths (ENG-010).

## Publish handoff

- The user performs every version bump, publish, install, git, and push action.
- The only user-facing release command is `./scripts/release-multiple.sh <folder> [<folder> ...] <patch|minor|major>` with short folder names. Never hand the user `release-package.sh` directly.
- Default to `patch` for all non-breaking changes, additive included. Include directly affected dependents only for a deliberate breaking bump.
- After `npm run test:quiet` is green, stop with the exact release command and combined `npm install @ttt-productions/<pkg>@latest ...` commands. Do not begin app adoption until the user explicitly continues.

## Review agents

- The main agent owns edits unless the user approves disjoint parallel implementers.
- Use approved subagents for read-only ownership audits, regression review, entry-point safety review, and test-gap analysis. Never run multiple full gates concurrently.
