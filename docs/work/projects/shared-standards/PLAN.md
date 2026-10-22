# shared-standards — one set of rules and AI docs for every product

This project moves everything ttt-prod, Q-Sports, and every future product share into one package,
`@ttt-productions/dev-standards`: the engineering rules, how an AI works with DJ, the development
workflows, the shared playbooks, the `docs/work/` rules, and the lint/TypeScript/test config. It
renumbers every rule so an ID is permanent and says whose rule it is, brings ttt-prod up to every
rule that becomes shared, and sweeps the comments under the comment rules.

The run touches ttt-packages and ttt-prod. Q-Sports gets its conversion table and notes from this
project and converts in its own parity conversation. The run starts only when DJ says all three repos
are free.

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
- `START_PROMPT.md` — how the run conversation starts.
- `CHATGPT_REVIEW_PROMPT.md` — the read-only ChatGPT review of this plan.
- `convert-rule-refs.mjs` — written by the run (group 1I). It stays here until Q-Sports has converted
  with it; this folder is deleted after that.

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
| Lint, TypeScript, test config | Shared through bases each app extends; the inventory and every exception are in § Config. |
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
  `…/node/postcss`, and `…/node/a11y` — the axe helper, group 1N), so `test/boundary/package-imports.test.ts` classifies them without a new
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

1F writes these into `claude/CLAUDE.base.md` § Normal Dev Flow and the ttt-packages release section:

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

1G writes `playbooks/crosswalk.md`: every `RULE-STD-*` rule → the shared playbook step(s) that audit
it, or "guard-enforced" naming the guard, or "no audit step yet" for DJ. No rule is left unlisted.

---

## ttt-prod compliance work

The stricter clauses (`merge-record.md`) and the promoted rules, checked against ttt-prod's current
code. A task here is necessary adoption of a rule that becomes shared, not new scope.

**Checked and already compliant (no task):** ARCH-105 (no `serverNow` / `FieldValue.serverTimestamp`
in `src` or `functions/src`); ARCH-101 (the only cross-root imports are the pair-proving tests under
`src/__tests__/app/`); ARCH-006 (ttt-prod's mentions of Q-Sports guard against touching it);
BACKEND-303 (every `maxInstances` lowers to 1); FRONTEND-003's palette clause (no Tailwind palette
class); FRONTEND-202's `window.confirm` (none); MEDIA-002's metadata check (`start-upload-core.ts`
checks the staged object's stored type and size); QUALITY-004's reseed clause (no spec reseeds);
BACKEND-212 (`adminReplayDeadLetter` takes a reason; the repair scripts are deleted).

**Work, packages half (Phase 1, group 1M):**

- **C1 — compound IDs (ARCH-109), `ttt-core` side.** One builder, and a parser where parts are read
  back, for every persisted compound document id: the follower counter
  (`PATH_BUILDERS.followCounter`'s `targetType__targetId`), the follow edge
  (`followerUid__targetType__targetId`), the threshold item (`workProjectId_itemId`), the NCII
  intake resource (`caseId__resourceKeyHash`), the square-announcement outbox job (`type_primaryDocId`),
  and the threshold submission event (`aggregationKey:time`); 1M first audits ttt-core and
  `functions/src` for any other and adds it. Tests prove builder/parser round-trips.

**Work, ttt-prod half (Phase 3):**

- **C1 — compound IDs, app side.** Every inline build or split of those ids uses the ttt-core
  builder/parser: `src/components/work-project/withdraw-from-review-control.tsx`,
  `functions/src/hall-library/runSubmitForThresholdLibraryReview.ts`, `src/server/ncii/intake.ts`,
  `functions/src/social/square-announcement-outbox.ts`, `functions/src/social/followTarget.ts`, and any
  the 1M audit adds.
- **C2 — truncation and page branches (FRONTEND-007).** The 101 per-site `truncate` / `line-clamp`
  uses in 43 `src/components` and `src/app` files move to the shared truncation class; every loading,
  empty, and error branch renders inside the page container; a truncated name that is the record's
  only identification keeps its full value in its accessible name or title.
- **C3 — session re-check (FRONTEND-108).** Every continuation after an awaited hop captures the uid
  and re-checks it through `isSessionOf` before each later step, toast, or navigation. Today only
  `use-leave-work-project.tsx` and `use-guild-invite-queries.tsx` do; the task audits every
  multi-step control and hook. (This is Q-Sports' `TTT_ITEMS.md` MRS-012 entry; Q-Sports' parity
  conversation removes that entry once this lands.)
- **C4 — answered reads keep their answer (FRONTEND-206).** Hooks hand back the last answered data
  beside a later failure, and surfaces keep it — and any open editor — on screen with the failure
  inline; no query surface has a loading branch without an error branch.
- **C5 — theme tokens (FRONTEND-003, 002, 008).** The three theme-varying tokens declared in `.dark`
  but not `.high-contrast` in `src/app/styles/brand.css` get their high-contrast values (DJ picks the
  values when the task shows them); every `overrides.css` rule names the utility it beats; `brand.css`
  holds tokens only.
- **C6 — backend audits (BACKEND-001, 004, 102, 204, ARCH-103, MEDIA-004, MEDIA-101).** One HIGH pass
  that checks and fixes: no link or callback URL assembled from fragments at a call site; no error
  message claiming an authority the code does not enforce; no bare `.set()` at a caller-reconstructable
  id; every failure audit records actor and target; every stored snapshot field that holds a name is
  named `…Snapshot` and is an audit-trail field; no client write to a processed-asset field; no render
  that falls back to an original when a processed size is missing.
- **C7 — client data layer (FRONTEND-102, 106).** One key builder per queryable scope, no alias, no
  key-prefix literal at a call site; one auth accessor, no redirect effect standing in for the gate,
  no gate that can stay loading forever.
- **D1 — delete the four scripts** and their tests, `package.json` entries, guard-config entries
  (`src/__tests__/guards/config/firestore.ts`, `repo.ts`), the `deploy-workflow.test.mjs` mention, and
  every doc reference (`CLAUDE.md`, four design docs, seven playbooks, the payment-incident and
  pledge-refund runbooks, the `runProcessStripePledgeEvent.ts` comment, ttt-prod's BACKEND-119
  addition). The runbooks point at the do-later item.
- **D2 — move ttt-prod's generic-package items** from ttt-prod `docs/work/` into
  `ttt-packages/docs/work/`. The orchestrator shows DJ the list first.

---

## Config

Every config file in both repos, and what happens to it:

| File | Outcome |
|---|---|
| ttt-prod `.prettierrc.json`, ttt-packages `.prettierrc.json` | Become the shared `config/prettier.json` (a one-line pointer file remains if Prettier needs one). |
| ttt-prod `tsconfig.json` | Extends `config/tsconfig.app.json`; keeps its paths and includes. |
| ttt-prod `functions/tsconfig.json`, `tsconfig.test.json`, `tsconfig.dev.json` | Extend `config/tsconfig.functions.json`; `tsconfig.dev.json` (identical in both apps) becomes a one-line extend. |
| ttt-prod `eslint.config.js`, `functions/eslint.config.js` | Import the `node/eslint` bases (app and Functions presets); keep their own scoped exceptions. |
| ttt-prod `vitest.config.ts`, `vitest.config.rules.ts`, `functions/vitest.config.ts` | Import the `node/vitest` base; `vitest.config.rules.ts` (identical in both apps) becomes a one-line import. |
| ttt-prod `playwright.config.ts` | Imports the `node/playwright` base. |
| ttt-prod `postcss.config.mjs` | Imports the `node/postcss` base (identical in both apps). |
| `.nvmrc`, `.gitattributes`, `components.json` (ttt-prod); `.nvmrc`, `.gitattributes` (ttt-packages) | Stay as copies, checked by the copy-drift test. |
| ttt-prod `next.config.ts` | Stays the app's own: its CSP, `transpilePackages`, and Sentry wiring are app facts. |
| ttt-prod `playwright.hosted-dev.config.ts` | Stays: hosted E2E is out of this project's scope. |
| ttt-prod `chat-worker`, `media-worker`, `app-edge-worker` `tsconfig.json` / `vitest.config.ts` | Stay ttt-prod's own: no second product has Workers. They join a base when one does. |
| ttt-prod `.prettierignore` | Stays (its paths are the app's). |
| ttt-packages `eslint.config.mjs`, `tsconfig.json`, `tsconfig.workspace.json`, `vitest.config.ts` | Stay ttt-packages' own: package-code settings no app shares. |

Every extracted setting is preserved: before a base replaces a file, 3E prints each tool's resolved
config (`tsc --showConfig`, ESLint's `--print-config` on a sample file, Vitest's resolved projects)
before and after, and the two must match except for differences DJ approves.

The copy-drift test lives at `src/__tests__/config/dev-standards-copies.test.ts` in ttt-prod and
`test/boundary/dev-standards-copies.test.ts` in ttt-packages; each compares its repo's copies with
the installed (or source) package's `config/copies/`.

---

## The converter — `convert-rule-refs.mjs`

Written by the orchestrator in 1I, kept until Q-Sports converts. It rewrites rule IDs and doc paths
from a table.

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
  marked fixtures; anything it cannot classify goes to the orchestrator, who settles it as a HIGH
  judgment edit.

---

## The run

The run is its own conversation, started from `START_PROMPT.md` only when DJ says all three repos are
free. It follows this plan, the repos' normal flows, and `development-preferences.md`. It proposes
each phase's agents (how many, each one's files, its tier) and starts them only on DJ's yes. Package
work and app work never run at the same time; the publish wait is the one overlap.

Every agent prompt carries: its exact owned files (it writes nothing else), its mandatory reading as
explicit paths (ENG-010), a hard ban on spawning agents, its tier (`docs/model-tiers.md` in the repo
it works in until the shared table is installed, then the shared table), targeted checks on its own
files only, and a stop clause (anything unexpected, or a needed change outside its files, stops it
and comes back). One HIGH reviewer checks each phase's work against the rules and this plan, and
checks every new or changed test against the rule it claims to prove.

**Mandatory reading.**

- **Phase 1 agents:** this plan; `merge-record.md`; the tables; `docs/development-preferences.md`;
  ttt-packages' `CLAUDE.md` and `docs/engineering-rules/` (README, core-rules, the files its work
  touches); ttt-prod's `docs/engineering-rules/README.md`, `core-rules.md`, and the area files its
  work touches; `docs/packages/package-architecture.md`; for a package it edits, that package's
  `docs/packages/*.md`.
- **Phase 3 agents:** this plan; the tables; the installed shared rulebook
  (the installed package's `rules/README.md`, `core-rules.md`, and its area files)
  **and** ttt-prod's own app rulebook (`docs/engineering-rules/` — written by 3C, which finishes before
  any other Phase 3 group starts); ttt-prod's `CLAUDE.md`; the `docs/design/*.md` its work touches.

### Phase 0 — preconditions

- DJ says all three repos are free; no other session is working in ttt-prod or ttt-packages.
- The ttt-packages tree is clean (the release preflight refuses a dirty tracked file).
- DJ is logged into the Firebase CLI (Phase 3 ends with the Normal TTT Test Flow).
- The tables still match the rulebooks: every rule heading in ttt-prod's and ttt-packages' rulebooks
  is in its table with the same title. A rule added, removed, or retitled since the tables were built
  is a stop and a question for DJ.

### Phase 1 — ttt-packages (packages-first)

The orchestrator owns the hot files: the root `package.json` / lockfile, `scripts/package-order.mjs`,
`packages/dev-standards/package.json`, `docs/packages/{dev-standards,package-architecture}.md`,
ttt-packages' `CLAUDE.md` and `AGENTS.md`, `docs/work/**` outside this project, and the converter.

**Step 1 — write the package (parallel, disjoint files):**

| Group | Work | Owned files | Tier |
|---|---|---|---|
| 1A Rules: core + comments | `rules/README.md`, `rules/core-rules.md` (ENG-001–011), `rules/comments/core-rules.md` without the fix-on-touch paragraph | `packages/dev-standards/rules/{README,core-rules}.md`, `rules/comments/**` | HIGH |
| 1B Rules: architecture | `rules/architecture/**` incl. the merges and ARCH-209 | `packages/dev-standards/rules/architecture/**` | HIGH |
| 1C Rules: backend | `rules/backend/**` incl. the promoted rules | `packages/dev-standards/rules/backend/**` | HIGH |
| 1D Rules: frontend + media | `rules/frontend/**`, `rules/media/**` | `packages/dev-standards/rules/{frontend,media}/**` | HIGH |
| 1E Rules: quality | `rules/quality/**` | `packages/dev-standards/rules/quality/**` | HIGH |
| 1F AI docs | `development-preferences.md` (moved verbatim), `model-tiers.md`, `AGENTS.base.md`, `claude/CLAUDE.base.md` (with the adoption workflow and the first-publish procedure), `work/*`, `runbooks/*`, `workflows/**` (ttt-prod's + `q-source/recheck-chatgpt-plan.md`; each merged difference listed for DJ) | `packages/dev-standards/{development-preferences,model-tiers,AGENTS.base}.md`, `claude/**`, `work/**`, `runbooks/**`, `workflows/**` | HIGH |
| 1G Playbooks | The shared playbooks from ttt-prod's versions (+ packages' `package-boundaries` and `REACT_LEAK_AUDIT`), placeholders, steps citing `RULE-STD-*`; `crosswalk.md`; a list of the ttt-prod steps that become ttt-prod additions | `packages/dev-standards/playbooks/**` | HIGH |
| 1H Config + code | `src/node/*.ts`, `config/**`, `tsconfig.json`, the package's tests | `packages/dev-standards/{src,config,__tests__}/**`, `packages/dev-standards/tsconfig.json` | HIGH |
| 1L Playbook checker | `repo-guards` `playbook-refs` takes several playbook folders (the installed shared folder and the app's own), resolves the shared folder's references against the package and the app's against the repo, skips placeholders, and keeps the checked-count floor per folder; a regression test proves a missing reference in an installed shared playbook fails | `packages/repo-guards/src/node/tooling/playbook-refs.ts` + its tests, `docs/packages/repo-guards.md` | HIGH |
| 1M ttt-core compound IDs | C1's ttt-core half | `packages/ttt-core/src/paths/**` (and the files its audit names, listed before it edits) + tests | HIGH |
| 1N Accessibility bases | after step 1's review fixes land: `eslint-plugin-jsx-a11y`'s recommended rules in the `node/eslint` app base; a `node/a11y` helper that runs `@axe-core/playwright` on a page in the default theme, the high-contrast theme, and with `reducedMotion: 'reduce'` emulated, failing on serious/critical violations; its tests; the crosswalk marks RULE-STD-FRONTEND-203 guard-enforced | `packages/dev-standards/src/node/{eslint,a11y}.ts`, its tests, `playbooks/crosswalk.md` (that row) | HIGH |

Rule-writing groups (1A–1E) author from `merge-record.md` and keep every app-specific clause and every
security detail out of the shared text; what they remove from a ttt-prod rule goes on a list for 3C.

**Step 2 — the orchestrator:** writes `docs/packages/dev-standards.md`, the `package-architecture.md`
entry, the build-chain and package-order entries; deletes ttt-packages' `docs/engineering-rules/` and
the moved `docs/playbooks/` files; rewrites ttt-packages' `CLAUDE.md` (values block + facts +
`@packages/dev-standards/claude/CLAUDE.base.md`) and `AGENTS.md`; creates `docs/work/README.md`, the
`adoptions/` folders, and the consent-mechanism item; adds ttt-packages' copy-drift test.

**Step 3 — 1I, the converter (orchestrator).** Writes and proves `convert-rule-refs.mjs`, then runs it
over ttt-packages (`q-core` excluded). Runs before any comment cleanup, so cleanup edits the
converted text.

**Step 4 — package comment sweep (parallel, disjoint).** The inventory is every tracked file in
ttt-packages that can hold a comment (`git ls-files` over code, config, tests, scripts, workflows,
and rules), minus generated and third-party material (`dist`, `docs/generated/**`, lockfiles,
`node_modules`) and `packages/q-core/**`. Each comment and test name is brought into line with the
comment rules; required semantic markers (the `SANCTIONED EXCEPTION` block, reasoned
`eslint-disable-next-line` lines, guard allowlist justifications) stay, and a guard that pins a
marker's text is updated with it.

| Group | Files | Tier |
|---|---|---|
| 1J1 | `packages/ttt-core/**` | HIGH |
| 1J2 | `packages/{chat-core,chat-react,chat-schemas,edge-protocol-core,realtime-core}/**` | HIGH |
| 1J3 | every other generic package, `test/**`, `scripts/**`, `.github/**`, root config files | HIGH |

**Step 5 — public-content gate (blocking), group 1K, HIGH, read-only then a fix list.** Every file
`npm pack --dry-run` lists for `dev-standards` — rules, docs, workflows, playbooks, config, code, and
anything generated — is checked against RULE-STD-ARCH-209. A finding blocks the first publish until
the orchestrator moves the detail into the owning app's private addition list (for 3C) and reruns
the check clean. The same check over `ttt-core` and the generic packages produces findings only, in
ttt-prod's private run notes, for DJ — never in this public repository, where a findings list would be a map.

**Step 6 — gate and hand-off.** The orchestrator writes the adoption files (one per released package
per app; `ttt-core` only to ttt-prod), runs one ttt-packages `npm run test:quiet`, then hands DJ the
three first-publish steps for `dev-standards` (ttt-packages `CLAUDE.md` § First-time publish of a new
package — the manual `npm publish --access public --workspace @ttt-productions/dev-standards`, the
npm trusted-publisher setup, then the release), with the release command for the whole batch
(`dev-standards` and every package whose files changed). STOP.

### Phase 2 — publish wait

While the session polls npm, it may prepare ttt-prod work that does not depend on the release: the
converter's dry-run report over ttt-prod, the comment-sweep inventory, and D2's item list for DJ.

### Phase 3 — ttt-prod

The orchestrator owns `package.json`, the lockfiles, `CLAUDE.md`, `AGENTS.md`, and
`src/__tests__/guards/config/{repo,firestore}.ts`.

1. **3A — install and convert (orchestrator).** Install `dev-standards` and the batch at `@latest
   --prefer-online` wherever declared; confirm the lockfiles name at least the adoption files'
   versions; delete those adoption files. Run the converter over ttt-prod (its tables; `ttt-packages
   <ID>` forms through the packages table), including `e2e-hosted-dev/` code comments.
2. **3B — entry files (orchestrator).** `CLAUDE.md` → values block + facts + `@import`; `AGENTS.md` →
   pointer; delete the moved docs (`docs/development-preferences.md`, `docs/model-tiers.md`, the
   moved workflows, the `docs/work` and `do-later` READMEs, the runbooks README and postmortem
   template); remove the `documentDrift` entry; point `scripts/check-playbook-refs.mjs` at both
   playbook folders (1L's new config).
3. **3C and 3D first — the private rulebook and playbook additions (parallel with each other only):**

| Group | Work | Owned files | Tier |
|---|---|---|---|
| 3C App rulebook | ttt-prod's `docs/engineering-rules/` holds only `RULE-TTT-*-9xx` rules and ttt-prod's additions and overrides on shared rules (from `merge-record.md`, and 1A–1E's removed-detail list, security detail included); each file opens with a link to its shared counterpart; the README routes to the shared rulebook first. Reads the current rules and the installed shared rules | `docs/engineering-rules/**` | HIGH |
| 3D App playbooks | ttt-prod's additions files for the shared playbooks (from 1G's list); the private playbooks re-cited to new IDs | `docs/playbooks/**` | HIGH |

4. **Then compliance and config (after 3C/3D land).** Each compliance group first reports the exact
   files it will edit; the orchestrator launches together only groups whose lists are disjoint, and
   runs the rest after.

| Group | Work | Tier |
|---|---|---|
| 3E Config | § Config, with the before/after resolved-config proof; owns the config files listed there and `src/__tests__/config/dev-standards-copies.test.ts` | HIGH |
| 3F C1 app side | compound-ID adoption | HIGH |
| 3G C2 | truncation and page branches | HIGH |
| 3H C3 | session re-check | HIGH |
| 3I C4 | answered reads keep their answer | HIGH |
| 3J C5 | theme tokens and stylesheets (DJ picks the three high-contrast values) | HIGH |
| 3K C6 + C7 | backend audits; client data layer | HIGH |
| 3L D1 | delete the four scripts and every reference | HIGH |
| 3M Docs re-point | every remaining doc that points at a moved path or an old rule shape (`docs/design/**`, `docs/runbooks/**`, `docs/README.md`, `docs/work/**`, `e2e-hosted-dev/*.md` pointers only) — fixed patterns by a LOW agent; every judgment edit goes to its HIGH owner, 3M-H | LOW + HIGH |
| D2 | the orchestrator moves the generic-package items DJ approved | orchestrator |
| 3U Accessibility checks | after 3E: first reports the jsx-a11y recommended baseline violation count (DJ decides warn or error), then wires the `node/a11y` helper into the Playwright e2e for a short key-page list, signed in through the existing test-auth fixtures, so it runs in `test:quiet`'s e2e stage. The existing reduced-motion and theme-token guards stay as they are | HIGH |

5. **Then the comment sweep (after every edit above lands).** The inventory is every tracked
   ttt-prod file that can hold a comment (`git ls-files`), minus generated and third-party material
   (`next-env.d.ts`, `.next`, `functions/lib`, `functions/build`, lockfiles, `node_modules`,
   `test-results`). Same rules and markers as step 4 of Phase 1.

| Group | Files | Tier |
|---|---|---|
| 3N | `functions/src/{safety,ncii,media,payments}/**` | HIGH |
| 3O | the rest of `functions/src/**`, `functions/scripts/**` | HIGH |
| 3P | `src/components/**`, `src/app/**` | HIGH |
| 3Q | `src/{lib,hooks,server,test}/**`, `src/proxy.ts`, `src/__tests__/**` except `src/__tests__/config/**` | HIGH |
| 3R | `scripts/**`, the three Worker trees, root config files, `firestore.rules`, `storage.rules`, `.github/**` | HIGH |
| 3S | `e2e/**`, `e2e-hosted-dev/**` code | HIGH |

6. **3T — reference and content checks (orchestrator).** The converter's no-old-ID / no-old-path
   check; the playbook checker over both folders; `npm pack`-equivalent listing of nothing private
   reaching ttt-packages.
7. **Review** — one HIGH reviewer over Phase 3.
8. **Verification** — one Normal TTT Test Flow (one agent owns `dev:e2e`).

### Phase 4 — Q-Sports hand-off

The run's one Q-Sports edit is `docs/work/projects/migration-2.0/ttt-parity/PARITY.md`. It updates
every place that holds the rulebook hold, so no contradictory line is left:

- § Settled decisions › **Rulebook** ("No agent renumbers, moves, or adds a rule until DJ has had that
  conversation", MRS-001's renumbering, the guard-suite item's "Q QUALITY-011/012", and "a guard that
  lands before it carries its ttt-prod rule ID in a comment only");
- § What has to happen before what (the Phase 6 line "rulebook waits for DJ's rules conversation");
- § Phase 6 › **Rulebook** ("Nothing moves until DJ's rules conversation" and its list of facts).

Each now points at `rules-conversion/` (already in place) and its README's packages-first order.

It also adds one Q-Sports parity step: adopt the shared ESLint base's accessibility rules and the
`node/a11y` helper, with Q-Sports' own key-page axe run (Q-Sports is browsable signed out, so its
list includes signed-out pages).

### DJ's actions in the run

- **Phase 0:** say the repos are free; ttt-packages is clean; log into the Firebase CLI.
- **Phase 1:** approve each step's agents; confirm the converter's fixture-data list; decide anything
  the public-content gate cannot settle; the `dev-standards` first publish (manual `npm publish`, the
  npm trusted-publisher fields, then the release command for the batch).
- **Phase 3:** approve each step's agents; approve D2's item list; pick the three high-contrast token
  values; approve any config setting that changes in the before/after proof; log into Firebase if the
  Test Flow asks.
- **Commit points:** after Phase 1's gate, after 3A's converter run, after the compliance edits, and
  after the comment sweep.

---

## Review findings and how each is handled

The ChatGPT review (verdict: ready after fixes) and its outcome:

1. **Public-content check must block** — done: Phase 1 step 5 blocks the first publish over everything
   the package ships; existing packages stay findings-only.
2. **One authoritative location** — done: this folder; the review had read a temporary copy that no
   longer exists.
3. **Packages-first boundary** — done: D2 moved to Phase 3; Q-Sports' README orders q-core and shared
   changes first.
4. **Mixed rules** — done: `merge-record.md`, with DJ's stricter-wins decision; BACKEND-301 takes
   ttt-prod's stricter text; business relaxations are explicit overrides.
5. **Promoted rules leave consumers behind** — done: § ttt-prod compliance work (C1–C7, with the
   compound-ID list), checked against the code; the repair scripts are deleted by DJ's decision.
6. **Path-table destinations** — done: exact paths with notes in their own column; app rule files keep
   their path and link their shared counterpart; § How a table path becomes a real reference.
7. **Phase 3 reading order** — done: 3C and 3D finish before any dependent group.
8. **Disjoint ownership** — done: the copy-drift test's path is named and excluded from 3Q; the
   converter runs before the package sweep; 3M's judgment edits have a HIGH owner; compliance groups
   launch only on disjoint file lists.
9. **Config scope** — done: § Config inventories every config file with an outcome and the resolved
   config proof.
10. **Package contract vs guards** — done: § Contract fits `publish-manifest` and `package-imports` as
    written.
11. **Playbook checker** — done: group 1L, with the regression case.
12. **Converter forms** — done: § The converter, with fixtures from real files.
13. **Complete sweep inventory** — done: both sweeps cover every tracked file that can hold a comment,
    `.github`, `functions/scripts`, root configs, and rules files included.
14. **Adoption workflow + audit crosswalk** — done: § Adoption workflow and § Audit coverage.
15. **PARITY holds** — done: Phase 4 names every occurrence.
