# `docs/work/` — all work to do

Every piece of work to do for this repo lives in its `docs/work/`, in exactly one folder for its
current state. Rules, designs, playbooks, and runbooks are not work and never live there. Finished
work is deleted — the tree only ever shows what is left. No README there or below lists the files a
folder holds: the folder is the list. This README is shared by every repo; each repo's `docs/work/`
follows it.

## The folders

- **`raw-findings/`** — unjudged output of an investigation: a review sweep, an error investigation,
  a playbook run, a walkthrough. One folder per run, named for the run. Its findings get judged — each
  becomes a `needs-decision/` or `waiting-to-be-implemented/` item, or is dropped — and the run folder
  is deleted once nothing in it is still unjudged.
- **`needs-decision/`** — one item per question only DJ can answer: a design call, a do-now-or-later
  choice, a product behavior. When DJ decides, it moves to `waiting-to-be-implemented/`, `do-later/`,
  or a project step, or is deleted.
- **`waiting-to-be-implemented/`** — decided work not tied to a project step. Deleted once implemented
  and verified.
- **`do-later/`** — decided work parked until its trigger fires, in domain sub-folders
  (`<DEV_STANDARDS>/work/do-later-README.md`). Moves out when DJ pulls it in; deleted when it ships.
- **`maybe-ideas/`** — post-launch ideas DJ has not decided to do. Not work: nothing here is built,
  designed, or asked about unless DJ brings it up. Moves to another folder when DJ says yes; deleted
  when he says no.
- **`blocked/`** — work waiting on something outside our control (an upstream release, a vendor fix).
  Moves to `waiting-to-be-implemented/` when the outside change lands.
- **`human-actions/`** — what only DJ can do: consoles, dashboards, devices. `HUMAN_ACTIONS.md` is the
  one running list. Deleted once done AND verified.
- **`projects/<name>/`** — a named multi-step effort: its `PLAN.md` and one folder per step that needs
  one. Deleted when the project ends.
- **`adoptions/<app>/`** — ttt-packages only: one folder per consuming app, named by that app's
  `<ADOPTION_APP>` value. Each file is one released package version the app still has to adopt,
  written by the package session before the release and deleted by the app session that installs
  and adopts it (`<DEV_STANDARDS>/claude/CLAUDE.base.md` § Adoption files). An app-data package's
  file goes only to its own app.

A project's steps can pull items in from the other folders; an item lives in one place at a time.

**Package work lives with whoever owns the package.** Generic-package work lives in ttt-packages'
`docs/work/`. An app-data package's work stays in its app's `docs/work/`. A job that needs both a
release and app work stays one item in the app; the adoption file covers the hand-off.

## The item format

One item per file. The file name is a short plain description in kebab-case
(`account-reconcile-row-isolation.md`) — no type prefix, because the folder says what it is.
Every item starts with the same header, so moving it between folders never means rewriting it:

```
# <Title>

**What:** <one line>
**Severity:** high | medium | low
**Came from:** <the review, investigation, or session that found it>
**Trigger:** <the event that makes it real work — do-later/, blocked/, and maybe-ideas/ only>
```

Items written before this format keep their older header until someone next edits them; that edit
switches the item to this header.

The body below the header is free-form: the evidence (path + symbol), why it matters, the fix shape,
what is out of scope, whether it is app-side, packages-side, or both, and how to prove it is done.

## Who reads and writes here

The development workflows (`<DEV_STANDARDS>/workflows/`) each name the folders they read and
write.
