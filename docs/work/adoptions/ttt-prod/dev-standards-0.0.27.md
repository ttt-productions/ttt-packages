# Adopt @ttt-productions/dev-standards 0.0.27

**What:** a shared orchestrator workflow, and the Orchestrator bullet in `development-preferences.md` points at it.
**Severity:** low
**Came from:** the Q-Sports migration-planning ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.27. Adopt `dev-standards-0.0.21.md`
  to `dev-standards-0.0.26.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.

## What changed

- **New workflow** `workflows/claude/orchestrate-a-project.md` (Jobs: Build or fix): how one
  conversation keeps a project in `docs/work/projects/` on track while DJ works its pieces in
  conversations of their own — the ledger, one-purpose pieces sized to finish, briefs holding only
  DJ's decisions, pieces started only on DJ's Go and then detached, how a handoff is checked, and
  pausing. A project with rules of its own keeps them in an app workflow, which wins for that project.
- **`development-preferences.md` § Agents, the Orchestrator bullet:** the orchestrator keeps its
  context for the whole project and never edits code; it reads code only to check work against DJ's
  decisions; its pieces are agents or conversations DJ works in, run as the new workflow says.

## What the app must change

- Install. ttt-prod has no orchestrator doc of its own, so nothing else changes.

**Done when:** the lockfiles name `@ttt-productions/dev-standards` 0.0.27 or later.
