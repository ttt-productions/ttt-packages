# shared-standards — one set of rules and AI docs for every product

The plan for sharing as much as possible between ttt-prod, Q-Sports, and future products through
ttt-packages: the engineering rules, the AI working docs, and the config. It also holds the plan
for the cleanup run that carries it out. Planning is still in progress, so this doc holds only what
DJ has decided. The run starts only when DJ says all three repos are free.

## Decided

### `docs/work/` in ttt-packages

- ttt-packages gets a `docs/work/` with the same layout, item header, and README rules as the apps'
  `docs/work/`, plus `adoptions/ttt-prod/` and `adoptions/q-sports/`.
- **An adoption file for every release, for every app that uses a released package.** The package
  session writes it in the same change as the package edit, before the release. Each file names the
  package and version, the release it shipped in, a very high-level line on what changed, what the
  app must change (often just the install), and how to know it is done. The app session that
  installs and adopts the release deletes the file. A package session cannot see which packages
  the other product installs, so every released package gets a file for both apps. The exception
  is an app-data package, which goes only to its own app (`ttt-core` to ttt-prod, `q-core` to
  Q-Sports). An app deletes a file for a package it does not use. This means a ttt-prod session never needs to
  read Q-Sports to know Q-Sports has an install waiting, and the reverse.

- **Package work lives with whoever owns the package.** Work on a generic package lives in
  `ttt-packages/docs/work/`. Work on `ttt-core` or `q-core` stays in its app's `docs/work/`, because
  those packages follow their app's rulebook. A job that needs both a package release and app work
  stays one file in the app, and the release's adoption file covers the hand-off. The run moves
  ttt-prod's generic-package items into ttt-packages. Q-Sports moves its own when it converts.

### Delivery

- **One npm package holds everything shared.** It is released and adopted like every other package.
  Each app's `CLAUDE.md` imports the shared base from `node_modules`, and its `AGENTS.md` points
  Codex at the same files. The workflows are written in skill format inside the package. A scratch
  test confirmed that `CLAUDE.md` imports from a gitignored `node_modules` load at session start,
  nested imports included. The package's `files` list must ship its docs; the run checks this with
  `npm pack --dry-run` before the first release.

### Layering — how every shared doc is built

- Shared text is product-neutral. It says "the product" or "the app's Normal Test Flow", and each
  app's `CLAUDE.md` names its product and its flows.
- An app adds to a shared doc in its own short file that imports the shared base, under a
  "`<App> additions`" heading.
- An app overrides a shared doc only by saying so explicitly: "Overrides shared `<doc>` § X: …". An
  unstated difference is drift.

### What is shared

- **`development-preferences.md`:** one copy in the package, imported by all three repos. Both drift
  tests are deleted (ttt-prod's repo-guards `documentDrift` entry, Q-Sports'
  `development-preferences-drift.test.ts`).
- **`AGENTS.md`:** one shared base telling Codex to read `CLAUDE.md` and everything it names. The
  hosted-E2E pointer ("operating the hosted E2E suite is the product's `e2e-hosted-dev/RUNNING.md`")
  is part of the base, since both apps get hosted E2E.
- **`model-tiers.md`:** one shared table for every product. An app may override a cell explicitly.
- **`docs/work/` README and `do-later/` README:** one copy for every product, ttt-packages included.

### Comment rules

- The comment cleanup is a deliberate sweep. "Fixed as files are touched, never in a separate sweep"
  is rewritten in ttt-prod's and ttt-packages' comment rules in this run. Q-Sports makes the same
  edit when it converts. The new wording goes to DJ before the run.
