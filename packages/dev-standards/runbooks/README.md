# `docs/runbooks/` — human procedures

Step-by-step procedures **a human executes** when something happens or needs operating. Each app
keeps its own runbooks in its `docs/runbooks/`; this README and `postmortem-template.md` are shared.
It is the home for incident response, admin-console how-tos, and (eventually) training material for
new team members.

How this differs from the neighbors:

- **Playbooks** — the shared `<DEV_STANDARDS>/playbooks/` and the app's own `docs/playbooks/` —
  procedures an **AI session** runs against the codebase (audits, sweeps, verification passes). If
  the actor is Claude, it's a playbook.
- **`docs/design/`** — how a **system works** (architecture, schemas, flows). Design docs may point
  at a runbook for the human side of a flow, and vice versa.
- **`docs/runbooks/`** (here) — what a **person** does, in order, with their hands: which page to
  open, which button to click, what the deadlines are, what "done" looks like.

## Format

One file per situation, kebab-case, named for the trigger or task (`<trigger>-runbook.md`,
`admin-page-basics.md`). Each runbook should state, in this order:

1. **Trigger** — what just happened / when you pick this doc up.
2. **Before you ever need this** — one-time prerequisites (enrollments, accounts, bookmarks).
3. **The steps** — numbered, in execution order, with the real UI surface or URL for each.
4. **The clocks** — any deadlines, what they actually mean, and which are legal vs contractual vs
   internal.
5. **Done when** — the verifiable end state.

`postmortem-template.md` is the exception to the one-file-per-situation rule: it is a template, not
a procedure. Completed postmortems live in each app's own `docs/postmortems/YYYY-MM-DD-<short-slug>.md`.

Keep runbooks accurate to the built system — they describe what the code and consoles actually do
today, never an aspirational flow. When the system changes, the runbook changes in the same breath
(same rule as design docs).
