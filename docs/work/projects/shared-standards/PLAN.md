# shared-standards — one set of rules and AI docs for every product

This project moves everything ttt-prod, Q-Sports, and every future product share into one package,
`@ttt-productions/dev-standards`: the engineering rules, how an AI works with DJ, the development
workflows, the shared playbooks, the `docs/work/` rules, and the lint/TypeScript/test config. It
renumbers every rule so an ID is permanent and says whose rule it is, brings ttt-prod up to every
rule that becomes shared, and sweeps the comments under the comment rules.

The run touches ttt-packages and ttt-prod. Q-Sports gets its conversion table and notes from this
project and converts in its own parity conversation.

**This folder is the one planning location.** Everything the run reads is here, except Q-Sports' own
materials, which live in Q-Sports:

- `PLAN.md` — this plan.
- `merge-record.md` — how every mixed shared rule is built: what the shared text keeps, what each app
  adds or overrides. The rule-writing groups author from it.
- `tables/` — the conversion tables (one row per rule or path):
  - `ttt-prod-rule-ids.csv`, `ttt-packages-rule-ids.csv` — old rule ID → new rule ID and its file.
  - `ttt-prod-paths.csv`, `ttt-packages-paths.csv` — old doc path → exact new path, its kind, its
    shared counterpart, and a note.
- `q-source/` — the Q-Sports texts the run needs, copied so the run never reads Q-Sports: the five
  promoted Q-Sports rules and the `recheck-chatgpt-plan` workflow. Every other Q-Sports clause the
  shared rules take is quoted in `merge-record.md`.
- `convert-rule-refs.mjs` — the converter. It stays here until Q-Sports has converted with it; this
  folder is deleted after that.

Q-Sports' materials: `C:\DjDev\q-sports-league\docs\work\projects\migration-2.0\ttt-parity\rules-conversion\`
(`q-sports-rule-ids.csv`, `q-sports-paths.csv`, `README.md`).

ttt-packages is a public repository. Nothing in this folder restates an app's security internals.

---

## Decided

### `docs/work/` in ttt-packages

- ttt-packages gets a `docs/work/` with the same layout, item header, and README as the apps (the
  README is the shared one), plus `adoptions/ttt-prod/` and `adoptions/q-sports/`.
- **An adoption file for every release, for every app.** The package session writes it in the same
  change as the package edit, before the release: the package and version, the release it shipped
  in, a very high-level line on what changed, what the app must change (often only the install), and
  how to know it is done. A package session cannot see which packages the other product installs, so
  every released package gets a file for both apps — except an app-data package, which goes only to
  its own app (`ttt-core` to ttt-prod, `q-core` to Q-Sports). The app session that installs and
  adopts the release deletes the file; an app deletes a file for a package it does not use.
- **Package work lives with whoever owns the package.** Generic-package work lives in
  `ttt-packages/docs/work/`. `ttt-core` and `q-core` work stays in its app's `docs/work/`. A job that
  needs both a release and app work stays one file in the app; the adoption file covers the hand-off.

### Delivery

- **One npm package, `@ttt-productions/dev-standards`, holds everything shared.** It is public, like
  every `@ttt-productions/*` package, and is released and adopted like every other package.
- Each app's `CLAUDE.md` imports the shared base from `node_modules` with `@path`; its `AGENTS.md`
  points Codex at the same files. A scratch test proved `CLAUDE.md` imports from a gitignored
  `node_modules` load at session start, nested imports included. ttt-packages reads the same files
  from its own source (`packages/dev-standards/`).
- The workflows are written in skill format. They are not switched on as Claude Code / Codex skills
  now; that is a later one-step change.

### Layering — how every shared doc is built

- **Placeholders.** Shared text names `<APP_NAME>`, `<APP_DATA_PACKAGE>`, `<CANONICAL_ORIGIN>`,
  `<INSTALL_FOLDERS>`, `<HOLDS_LIVE_DATA>`, and the like. Each app's `CLAUDE.md` declares the values
  once, in a block at its top; the AI resolves them while reading. Nothing is rewritten at install
  time. An app with no value for a placeholder says so in its block.
- **Additions.** An app adds to a shared doc in its own file, under a "`<App> additions`" heading.
- **Overrides.** An app overrides shared text only explicitly: "Overrides shared `<doc>` § X: …". An
  unstated difference is drift.
- **Stricter wins.** Where two rulebooks state one rule differently, the shared rule takes the
  stricter clause, and the plan carries every repo's catch-up work. Business relaxations stay explicit
  app overrides. `merge-record.md` applies this rule by rule.

### What is shared

| Item | Decision |
|---|---|
| `development-preferences.md` | Shared, one copy. Both drift tests are deleted (ttt-prod's repo-guards `documentDrift` entry; Q-Sports' `development-preferences-drift.test.ts`). |
| `AGENTS.md` | Shared base. The hosted-E2E pointer is in the base. The repo file is a pointer plus its values. |
| `model-tiers.md` | One shared table. An app overrides a cell only explicitly. |
| `CLAUDE.md` | Shared `claude/CLAUDE.base.md`: the Claude Code preferences pointer, mandatory reading, the docs/work and project rules, the adoption-file steps, and the Normal Test and Dev Flows with placeholders. Each app's `CLAUDE.md` is its values block, its facts, and one `@import`. ttt-prod's hosted-wipe exemption is a ttt-prod addition. ttt-packages imports the same base. |
| Development workflows | All shared, with the menu README: the 13 both apps have, plus `claude/recheck-chatgpt-plan` (ttt-prod gains it). `chatgpt/migration-review-sweep` stays Q-Sports-only until the 2.0 migration deletes it. Kickoff lines name the product. Each merged difference is shown to DJ. |
| Engineering rules | One shared rulebook (below). |
| Playbooks | The playbooks that audit shared rules are shared, built from ttt-prod's versions with placeholders; app-specific commands are app additions at the app's same-named file; business and app-infrastructure audits stay private in the app. Every step cites the rule IDs it audits; rules no longer cite playbook steps. |
| `docs/work/` README + `do-later/` README | Shared. No item Status line. `maybe-ideas/` is included. `do-later/` uses domain sub-folders. |
| Runbooks README + postmortem template | Shared. `docs/postmortems/` stays per app. |
| `release-pipeline.md` | Per app (follows the deploy workflow). |
| `analytics-consent.md` | Per app. The run writes a ttt-packages `docs/work/waiting-to-be-implemented/` item to move the consent mechanism into a package; its doc moves with it. |
| Design docs | No shared app design docs. A mechanism in a package keeps its design in ttt-packages' `docs/packages/` or `docs/design/`; an app design doc describes only app behavior. |
| Lint, TypeScript, test config | Shared through bases each app extends. |
| CI deploy workflow | Per app. Q-Sports copies ttt-prod's in parity. |
| Scripts | Not shared in this run. ttt-prod's are thin wrappers over `repo-guards`; Q-Sports catches up in parity. |
| Claude Code skills, commands, hooks | Not now. |

### The rulebook

- **One shared rulebook** in `dev-standards/rules/`, product-neutral, with ttt-packages' rulebook
  merged in. Every rule states its scope: apps, packages, or both.
- **Each app keeps a small rulebook**: only its business rules, plus its additions and overrides on
  shared rules, in the same folder layout. Each app file opens with a link to its shared counterpart.
  ttt-packages keeps no rulebook of its own.
- **IDs.** `RULE-STD-<AREA>-NNN` for shared rules; `RULE-TTT-<AREA>-NNN` and `RULE-QS-<AREA>-NNN` for
  app rules; a new product gets `RULE-<PRODUCT>-`. `RULE-` matches nothing in ttt-prod or
  ttt-packages today, so a search for `RULE-` finds every rule citation, and no ID is a substring of
  another. IDs are permanent from now on: never reused, never renumbered.
- **Number bands.** Shared rules use 001–499 (an area's core 001–099, its topic files 100s–400s) and
  keep ttt-prod's current number wherever there is no clash. App rules use 900–999 in every area; the
  two apps may reuse the same 9xx numbers. 500–899 stays empty. Promoting an app rule to shared gives
  it a new low number; its 9xx number is retired, never reused.
- **Promoted to shared:** Q-Sports ENG-011, ARCH-006, ARCH-109, BACKEND-212, QUALITY-009
  (→ `RULE-STD-QUALITY-011`); ttt-prod BACKEND-012, BACKEND-013, BACKEND-310.
- **Merged:** ttt-prod ARCH-202 + packages ARCH-202; ARCH-203 in all three; QUALITY-102 in all three;
  ttt-prod BACKEND-120 + Q-Sports QUALITY-010 (`RULE-STD-BACKEND-120`); packages QUALITY-008/009 are
  ttt-prod QUALITY-009/010.
- **Inside Q-Sports:** ARCH-108 and SPORT-002 fold into one rule, `RULE-QS-SPORT-902`, in Q-Sports'
  own conversion.
- **New `RULE-STD-ARCH-209` — everything in ttt-packages is public.** Package code, package docs, and
  the shared rules, workflows, and playbooks never name an app's security internals: emulator bypass
  gating, route-guard or provenance mechanics, secret or key handling, detection thresholds, the shape
  of a privileged path. That detail lives only in the app's private repo.
- **BACKEND-212's scope.** Rebuilding a derived copy from an untouched source is not a repair of a
  completed record.
- **Comment rules.** The paragraph "existing code still carries comments that break these rules; they
  are fixed as files are touched, never in a separate sweep" is deleted: the run's sweep leaves no old
  comments behind. The paragraph sending a comment the rules do not settle to DJ stays.

### ttt-prod scripts

- `scripts/recompute-follower-counts.mjs`, `scripts/recompute-pledge-totals.mjs`,
  `scripts/backfill-public-guildmate-users.mjs`, and `scripts/migration-paging.mjs` are deleted, with
  their tests and every reference to them. The pledge-totals purpose is kept as
  `ttt-master-app/docs/work/do-later/ops-and-automation/pledge-totals-drift-check.md`.
- `scripts/firestore-drift-check.mjs` and `firestore-drift-templates.mjs` stay (the weekly
  `firestore-drift-check.yml` runs them). `scripts/hosted-workers.mjs` stays.
- None of these exist in Q-Sports.

---

## The shared package

### Contract

`dev-standards` is a resource package with one small built part, and it fits the existing package
guards without loosening them:

- **Docs ship as plain files.** `files` lists each folder literally: `rules`, `claude`, `workflows`,
  `playbooks`, `work`, `runbooks`, `config`, `development-preferences.md`, `model-tiers.md`,
  `AGENTS.base.md` — plus `dist`. None holds TypeScript source, so
  `test/boundary/publish-manifest.test.ts` passes as written.
- **Config bases that are code** (ESLint, Vitest, Playwright, PostCSS) are TypeScript compiled to
  `dist` and exported under the existing `node` runtime subpath convention
  (`@ttt-productions/dev-standards/node/eslint`, `…/node/vitest`, `…/node/playwright`,
  `…/node/postcss`, and `…/node/a11y` — the axe helper), so `test/boundary/package-imports.test.ts` classifies them without a new
  exception.
- **JSON bases** (`config/tsconfig.app.json`, `config/tsconfig.functions.json`, `config/prettier.json`)
  ship as files and are exported by path (`./config/*.json`).
- **Copies** — `config/copies/.nvmrc`, `.gitattributes`, `components.json` — ship as files; each repo
  keeps its own copy, checked by a copy-drift test.
- `scripts`: the standard `build`, `clean` (removes `dist`), and `prepublishOnly`
  (`npm run clean && npm run build`).
- It depends on no `@ttt-productions/*` package; it joins the root build chain and
  `scripts/package-order.mjs` as a tier-0 foundation.
- `docs/packages/dev-standards.md` states what it owns and how an app consumes it;
  `docs/packages/package-architecture.md` § Subpath conventions names its `node/*` and
  `config/*` entries.

### Layout

```
packages/dev-standards/
  package.json, tsconfig.json, src/node/{eslint,vitest,playwright,postcss}.ts
  development-preferences.md, model-tiers.md, AGENTS.base.md
  claude/CLAUDE.base.md
  rules/README.md, rules/core-rules.md
  rules/{architecture,backend,frontend,media,quality,comments}/…   (ttt-prod's file layout)
  workflows/README.md, workflows/{claude,chatgpt}/*.md
  playbooks/README.md, playbooks/*-playbook.md, playbooks/crosswalk.md
  work/README.md, work/do-later-README.md
  runbooks/README.md, runbooks/postmortem-template.md
  config/{tsconfig.app.json,tsconfig.functions.json,prettier.json}, config/copies/…
  __tests__/…
```

### How a table path becomes a real reference

A `new_path` beginning `@ttt-productions/dev-standards/` is package-relative. The converter turns it
into what the citing file needs:

- In ttt-prod (and later Q-Sports) docs and `CLAUDE.md`: `node_modules/@ttt-productions/dev-standards/…`
  for an `@import`, and a relative Markdown link from the citing file to that path for a link.
- In ttt-packages: `packages/dev-standards/…`, by the same two forms.
- A rule-specific reference (an ID, or a link with a rule anchor) resolves through the rule table,
  never the path table; anchors are rebuilt from the new heading.
- A reference to a whole app rule file stays on the app file, which opens with a link to its shared
  counterpart, so a reader reaches both.

### Adoption workflow (shared operational text)

`claude/CLAUDE.base.md` § Normal Dev Flow and the ttt-packages release section hold these:

- **Before the release command**, the package session writes one adoption file per released package
  for each app (the app-data exception above), naming the version the release will publish — one
  patch above the package's `package.json` version before the release.
- **At the start of any app session**, and after every install, the session lists
  `ttt-packages/docs/work/adoptions/<app>/`. An install confirms the lockfile's version is at least the
  file's version; a lower installed version is a stop. The session then does the file's work and
  deletes the file.
- The complete first-publish procedure in ttt-packages' `CLAUDE.md` § First-time publish of a new
  package moves into the shared base unchanged.

### Audit coverage

`playbooks/crosswalk.md` maps every `RULE-STD-*` rule → the shared playbook step(s) that audit
it, or "guard-enforced" naming the guard, or "no audit step yet" for DJ. No rule is left unlisted.

---

## The converter — `convert-rule-refs.mjs`

Kept until Q-Sports converts. It rewrites rule IDs and doc paths from a table.

- **Forms it handles** (each with a fixture taken from real files):
  - a bare ID (`BACKEND-301`);
  - grouped IDs (`BACKEND-003/006`, `FRONTEND-201 / 205`, `QUALITY-101–104`, `QUALITY-001..004`,
    `ENG-001–011`), expanded so each member maps on its own; a group whose members land in different
    prefixes or numbers is written out in full;
  - a qualified ID (`ttt-packages QUALITY-102`, `ttt-packages QUALITY-102 and ARCH-201`), resolved
    through the packages table, with the qualifier dropped once the ID is `RULE-STD-*`;
  - band references in headings (`ARCH-100–199`), rewritten to the new band;
  - IDs inside strings: ESLint diagnostic messages, test titles, guard titles, `firestore.rules` /
    `storage.rules` comments;
  - Markdown links with rule anchors, relative paths, and Windows paths in docs.
- **What it never rewrites:** literal fixture data whose purpose is the old text (marked in its
  dry-run classification and confirmed by DJ), and `q-core` (Q-Sports converts it).
- **Scope by file:** `packages/ttt-core/**` uses the ttt-prod table (it follows ttt-prod's rulebook);
  every other ttt-packages file uses the packages table; ttt-prod files use the ttt-prod table, with
  `ttt-packages <ID>` forms through the packages table.
- **Proof:** a dry run prints every rewrite classified by form; a second run on the rewritten tree
  changes nothing; after the run no old-form ID and no old path from the tables remains outside the
  marked fixtures; anything it cannot classify goes to the session running it, which settles it as a HIGH
  judgment edit.

---

---

## What is left

- ttt-prod's last Phase 3 items and its Normal TTT Test Flow, tracked privately in ttt-prod.
- Q-Sports converts in its own parity conversation, with `convert-rule-refs.mjs` and its
  `rules-conversion/` tables. This folder is deleted after that.
