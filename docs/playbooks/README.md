# Playbooks

Audit methodologies for verifying `@ttt-productions/*` packages still follow the
rules in `docs/design/`. A playbook is a step-by-step procedure — grep snippets
and commands — that ends in a pass/fail verdict. Methodology only: never record
findings here.

## How to use this folder

- One playbook per audit topic; the methodology is permanent.
- Each playbook follows: **Purpose** / **When to run** / **Audit steps**
  (numbered, with grep/command snippets) / **Common failure patterns** /
  **Output / Pass-fail criteria**.
- A run's findings go in `docs/audits/<topic>-<date>.md`, not back into the
  playbook. Delete that audit file once everything in it is resolved — playbooks
  persist, audit outputs are transient.
- If a step later gets enforced by a CI script, keep the step but annotate it
  "enforced in CI by `<script>`."

Write a new playbook when a real, recurring drift risk appears — not
speculatively.
