# Codex instructions for ttt-packages

Read this repository's `CLAUDE.md` before reviewing, planning, editing, or running commands. The workspace-level `C:\DjDev\AGENTS.md` also applies.

## Package implementation

- Implement shared behavior in the package that owns the concept. Keep generic packages free of TTT-specific identifiers, copy, paths, and business policy; compose application-specific behavior in `ttt-core` or the consuming app.
- For a multi-item sweep, finish every package-owned change before the consuming app is touched. Use focused tests while editing and one final `npm run test:quiet` for the complete package batch.
- Preserve entry-point boundaries: server-safe main entries, React under `/react`, Admin SDK under `/server`, and browser-only runtime under `/browser`.
- Preserve unrelated uncommitted work. Do not remove or modify `.claude/worktrees/` or other user-owned artifacts.

## Publish handoff

- The user performs every version bump, publish, install, git, and push action.
- The only user-facing release command is `./scripts/release-multiple.sh <folder> [<folder> ...] <patch|minor|major>` with short folder names. Never hand the user `release-package.sh` directly.
- Default to `patch` for all non-breaking changes, additive changes included. Include directly affected dependents only for a deliberate breaking bump.
- After `npm run test:quiet` is green, stop with the exact release command and combined `npm install @ttt-productions/<pkg>@latest ...` commands. Do not begin app adoption until the user explicitly continues.

## Review agents

- The main agent owns edits unless the user approves disjoint parallel implementers.
- Use approved subagents for read-only ownership audits, regression review, entry-point safety review, and test-gap analysis. Never run multiple full gates concurrently.
