# Codex instructions for ttt-packages

Read this repository's `CLAUDE.md` before reviewing, planning, editing, or running commands. The workspace-level `C:\DjDev\AGENTS.md` also applies.

## Absolute obedience

DJ's commands and written rules are absolute. The agent executes exactly what DJ instructs — never ignore a command; never substitute the agent's own judgment, a plan document's staging, or another tool's output (ChatGPT/Codex/etc.) for DJ's written rules or in-chat instructions; a doc's "staged/later/deferred" label is never DJ's decision. Any deviation from DJ's rules or instructions means STOP and ASK first — never self-authorized. Never write "(DJ ruling <date>)" or dated decision attributions into DJ's docs — rules and designs are stated as plain standing fact.

## Mandatory reading protocol

- Engineering rules are ONE system for both repos and live in ttt-prod. Before reviewing, planning, designing, editing, or running implementation commands, read `C:\DjDev\ttt-master-app\docs\engineering-rules\README.md` and `docs\engineering-rules\core-rules.md` (the ten universal `ENG-*` rules), plus the routed area files per that README's routing table — `architecture/packages-and-boundaries.md`, the `quality/` rules, and the `comments/` rules apply to essentially every package task; add other areas the change touches.
- Read `docs/packages/package-architecture.md` in full and the relevant `docs/packages/*.md` ownership docs (and the cross-cutting `docs/design/*.md` invariants) before adding an import or export. Then inspect the current code — code is the implementation truth. This applies on every new package task; do not infer ownership from memory.
- Confirm dependency direction and the public entry-point boundary before adding an import or export. Main entries stay server-safe; React, browser, and Admin SDK code stay behind their canonical subpaths (ARCH-202).
- Implement shared behavior in the package that owns the concept; keep generic packages free of TTT identifiers, copy, paths, and policy (ARCH-201). Update the affected package design/ownership doc when behavior changes; do not create a new doc unless the user asks.
- Any prompt that spawns an implementation, design, or review agent names that agent's mandatory reading as explicit paths (ENG-010).

## Publish handoff

- The user performs every version bump, publish, git, and push action. Installs of a release the user has published are the agent's (below).
- The only user-facing release command is `./scripts/release-multiple.sh <folder> [<folder> ...] <patch|minor|major>` with short folder names. Never hand the user `release-package.sh` directly.
- Pre-launch, every release is `patch` — additive exports, fixes, and breaking changes alike; never hand off `minor` or `major` (`CLAUDE.md` § Version bump selection). A breaking change still requires confirming that no consumer relies on what it removes or alters before it ships as a patch.
- After `npm run test:quiet` is green, stop with ONLY the exact release command in its own fenced `bash` block — no install commands. When the user says the publish is running, start a 12-minute clock and check npm every 30 seconds until every released package's new version is `@latest`; then run the installs yourself in the consuming app in scope (`@latest --prefer-online`, at the app root and in every consuming folder that declares the package), confirm each lockfile names the new version, and continue the app adoption with no further go. A version still missing after 12 minutes: stop and tell the user which package. Never install anything but the published version.

## Review agents

- The main agent owns edits unless the user approves disjoint parallel implementers.
- Use approved subagents for read-only ownership audits, regression review, entry-point safety review, and test-gap analysis. Never run multiple full gates concurrently.
