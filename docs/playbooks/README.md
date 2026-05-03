# Playbooks

Audit methodologies for verifying `@ttt-productions/*` packages still follow the rules in `docs/design/`. Each playbook is a step-by-step procedure with grep-based scripts and pass/fail criteria — methodology only, not findings.

## How to use this folder

- One playbook per audit topic.
- Each playbook has: **Purpose** / **When to run** / **Audit steps** (numbered, with grep snippets) / **Common failure patterns** / **Output / Pass-fail criteria**.
- Findings from a playbook run go in `docs/audits/<topic>-<date>.md` (one-off output), not back into the playbook itself.
- After resolving everything in an audit output, delete the audit file. Playbooks are permanent; audit outputs are transient.
- If a playbook step gets superseded by a CI check (e.g. an `npm run audit:react-leaks` script that runs the same grep), the playbook step stays but is annotated with "enforced in CI by `<script>`."

## Current playbooks

- `REACT_LEAK_AUDIT_PLAYBOOK.md` — Verify every package's main entry is server-safe and React UI lives behind `./react`. See `docs/design/react-safety.md` for the rule being audited.

## Playbooks that should exist (not yet written)

These are gaps. Add them when the corresponding pain point materializes; don't write them speculatively.

- Display-identity drift audit — grep shared types for `displayName` / `profileImage` fields that violate `docs/design/display-identity-invariant.md`.
- Upload-path-invariant audit — same grep as ttt-prod's `CODEBASE_HYGIENE_PLAYBOOK.md` step 4a, applied to `packages/`.
- Dependency-graph audit — verify the tier structure in `CLAUDE.md` matches actual `package.json` dependencies; flag any package that has accidentally crept up a tier.
- Publishing-state audit — for each package, confirm the source `package.json` version matches the latest published npm version (or is intentionally ahead).
