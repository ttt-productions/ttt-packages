# Engineering rules (shared)

How software is created and changed in every product built on the `@ttt-productions/*` packages, and in those packages. This is the one shared rulebook, shipped in `@ttt-productions/dev-standards`: an app reads it at `node_modules/@ttt-productions/dev-standards/rules/`, ttt-packages at `packages/dev-standards/rules/`. Each app keeps a small rulebook of its own beside it (§ App rulebooks); ttt-packages keeps none. This folder is NOT: business policy (an app's `docs/design/`), package ownership and design (ttt-packages' `docs/packages/` and `docs/design/`), audit procedure (the playbooks), human operations (the runbooks), or how an AI works with DJ (`development-preferences.md`).

## Mandatory reading protocol

- **Every conversation** — review, investigation, planning, documentation, testing, or implementation: read this README and [core-rules.md](core-rules.md), then, in an app, the app's own `docs/engineering-rules/README.md` and `core-rules.md`. No exceptions, no relying on memory of a past task.
- **Work in a focused area**: read that area's `core-rules.md` in full, plus **only** the topic files whose named topic the work actually touches (routing table below) — each shared file together with the app's counterpart file. Tasks route to every area they touch, and to no topic file they don't.
- **Package work**: `architecture/` (with [packages-and-boundaries.md](architecture/packages-and-boundaries.md)), `quality/`, and `comments/` apply to essentially every package task.
- **Work involving a system**: in an app, read its `docs/design/*.md`; in a package, ttt-packages' `docs/packages/package-architecture.md`, the owning package's `docs/packages/*.md`, and the `docs/design/*.md` invariants it touches. Then inspect the current code — code is the implementation truth. If code and doc disagree, surface it (RULE-STD-ENG-008); never silently pick one.
- **Deliberate audits**: use the playbooks (the shared ones and the app's own). Playbooks cite the rule IDs they audit; `playbooks/crosswalk.md` maps every shared rule to its audit.

## Routing table

Routing is **conditional and per file** — never "read the folder". Two independent decisions:

1. **Does the task touch this area?** If yes, read that area's `core-rules.md` — always, in full.
2. **Does the task touch this topic?** A topic file is read ONLY when the work touches the topic named in its row below. Being routed to an area does **not** pull in that area's topic files.

| Folder | Route to the area when the task touches | Always read when routed here |
|---|---|---|
| [architecture/](architecture/core-rules.md) | where code lives, ownership, cores, contracts, schemas/constants, package boundaries, a cross-tree trust contract, anything cross-boundary | `core-rules.md` |
| [backend/](backend/core-rules.md) | callables, privileged request handlers and server modules, data-writing scripts, triggers, schedules, Firestore/Storage writes or rules, auth, audit, money, moderation | `core-rules.md` (auth & authorization) |
| [frontend/](frontend/core-rules.md) | components, CSS/theming, React Query, callable calls from the client, UX states, browser storage — in an app or a React package | `core-rules.md` (component & style system, device-local state) |
| [media/](media/core-rules.md) | uploads, media processing, serving, rendering stored files | `core-rules.md` (upload & processing) |
| [quality/](quality/core-rules.md) | tests, gates, lint, monitoring, docs upkeep — i.e., effectively every implementation task | `core-rules.md` (testing & verification) |
| [comments/](comments/core-rules.md) | writing, editing, or reviewing code of any kind — source, tests, scripts, config, rules files — since every file carries comments | `core-rules.md` (comments) |

### Topic files — read ONLY when the work touches the named topic

| Topic file | Read when the work touches |
|---|---|
| architecture/[data-and-contracts.md](architecture/data-and-contracts.md) (100s) | a schema, constant, canonical type/union, option map, Firestore path builder, compound document id, or query key — any shape crossing a boundary |
| architecture/[packages-and-boundaries.md](architecture/packages-and-boundaries.md) (200s) | a `@ttt-productions/*` package: its API, entries, dependencies, ownership split, public content, or a release/adoption cycle |
| backend/[firestore-storage-and-transactions.md](backend/firestore-storage-and-transactions.md) (100s) | a Firestore or Storage read/write (including a script or a package that writes), transaction/batch, index, or a `firestore.rules` / `storage.rules` change |
| backend/[sensitive-writes-and-audit.md](backend/sensitive-writes-and-audit.md) (200s) | money, moderation, roles/status/claims, an admin or repair action, or an audit event |
| backend/[background-work-and-external-effects.md](backend/background-work-and-external-effects.md) (300s) | post-commit effects, triggers/schedules/workers, an outbox/queue/retry path, notifications, or an external service |
| frontend/[data-and-callable-access.md](frontend/data-and-callable-access.md) (100s) | React Query (hooks, query keys, invalidation), an auth-scoped subscriber, a callable invoked from the client, or deciding whether the UI offers an action |
| frontend/[interaction-accessibility-and-motion.md](frontend/interaction-accessibility-and-motion.md) (200s) | an async control's pending state, a confirmation, an in-app navigation, a loading/empty/error state, an editor holding unsaved input, keyboard/focus/ARIA behavior, pointer or gesture handling, animation or motion |
| media/[serving-and-rendering.md](media/serving-and-rendering.md) (100s) | rendering or serving a stored file (the app's media renderer, a viewer package), or changing whether one is servable (hide, restore, quarantine, retire) — not an upload-only change |
| quality/[reliability-and-observability.md](quality/reliability-and-observability.md) (100s) | error handling, monitoring and its package seams, alerting, or a durable-retry / failure path |
| quality/[documentation-and-drift.md](quality/documentation-and-drift.md) (200s) | a design doc, package doc, playbook, runbook, or a rulebook |

Worked examples:

- **CSS-only fix** → `frontend/core-rules.md` + `quality/core-rules.md` + `comments/core-rules.md`. Zero topic files: no React Query, no callable, no a11y/motion change, no docs change.
- **New callable** → `architecture/` + `backend/` + `quality/` + `comments/` core rules, plus `architecture/data-and-contracts.md` (its input schema) and `backend/firestore-storage-and-transactions.md` (its writes). Add `backend/sensitive-writes-and-audit.md` only if it touches money/moderation/roles/audit; add `frontend/core-rules.md` + `frontend/data-and-callable-access.md` only if it has a client caller.
- **Media upload change** → all six `core-rules.md`, plus `architecture/data-and-contracts.md`, `backend/firestore-storage-and-transactions.md`, `frontend/data-and-callable-access.md`, and `media/serving-and-rendering.md` if the change also renders the result.
- **React package hook change** → `architecture/core-rules.md` + `architecture/packages-and-boundaries.md` + `frontend/core-rules.md` + `quality/core-rules.md` + `comments/core-rules.md`; add `frontend/data-and-callable-access.md` if it reads server state.

## Scope

Every rule states its scope on its **Scope** line: **apps** — an app's code, including its application-data package (`<APP_DATA_PACKAGE>`), which follows its app's rulebook (RULE-STD-ARCH-207); **packages** — generic `@ttt-productions/*` package code; **both** — all of it. A rule's text may still name the application-data package where it binds it as a package (its entries, its release). Where a **both** rule's clauses differ by scope, it labels them **Apps:** and **Packages:**. A rule whose scope excludes the work does not bind it.

## App rulebooks

- Each app keeps its own `docs/engineering-rules/`, in this folder's layout with the same file names. It holds only the app's business rules (its `9xx` rules) and its additions and overrides on shared rules. Each app file opens with a link to its shared counterpart, and the app's README routes to this rulebook first, then to its own files.
- **Placeholders.** Shared text names app values as placeholders such as `<APP_NAME>` and `<APP_DATA_PACKAGE>`; every one is listed with its meaning in [../claude/CLAUDE.base.md](../claude/CLAUDE.base.md) § Placeholders. Each app's `CLAUDE.md` declares the values once, in a block at its top; the reader resolves them while reading. An app with no value for a placeholder says so in its block.
- **Additions.** An app adds to a shared rule in its counterpart file, under a "`<App> additions`" heading naming the shared rule ID.
- **Overrides.** An app overrides shared text only explicitly: "Overrides shared RULE-STD-… § …: …". An unstated difference is drift (RULE-STD-ENG-008).
- **Stricter wins.** Where the shared rule and an app's text state one obligation differently, the stricter clause binds. A business relaxation exists only as an explicit override.

## Rule IDs

- `RULE-STD-<AREA>-NNN` is a shared rule; `RULE-TTT-<AREA>-NNN` a ttt-prod rule; `RULE-QS-<AREA>-NNN` a Q-Sports rule; a new product takes `RULE-<PRODUCT>-<AREA>-NNN`. Areas: `ENG` (universal), `ARCH`, `BACKEND`, `FRONTEND`, `MEDIA`, `QUALITY`, `COMMENT`; an app may add a business area of its own.
- IDs are permanent — never renumbered, never reused. A moved rule keeps its ID; a deleted rule's number is never reissued. Cite a rule by its full ID (`RULE-STD-BACKEND-301`), optionally with the file path for reader convenience; a search for `RULE-` finds every citation.
- **Number bands.** Shared rules use `001–499`: `001–099` in the area's `core-rules.md`, the `100s`–`400s` in its topic files (each file's band is in the tables above). App rules use `900–999` in every area, and two apps may use the same `9xx` numbers. `500–899` stays empty. A promoted app rule gets a new low shared number, and its `9xx` number is retired, never reused.

## Standard rule format

```md
### RULE-STD-AREA-NNN — Title
**Scope.** apps | packages | both

**Rule.** The requirement, one to three sentences.

**Why.** One or two sentences stating the failure this prevents.

**Prohibits.**
- Concrete recognizable violations.

**References.** Related rule IDs, design docs, package docs.
```

Concision never removes exceptions, trust boundaries, ownership, or failure behavior. Examples only where the rule would otherwise be ambiguous. A rule cites rule IDs and docs, never a playbook step — the playbooks cite the rules.

## Size budgets (load-bearing — mandatory reading only works if it stays cheap)

This README ≤ 120 lines. Universal `core-rules.md` ≤ 150 lines. Each area `core-rules.md` ≤ 200 lines. Topic files and app files stay lean; system explanation belongs in design docs, audit commands in playbooks. A file over budget gets tightened or split with DJ's approval — never silently bloated.

## Spawned-agent contract (RULE-STD-ENG-010)

Subagents do not discover rules — orchestrators route them. Every prompt that spawns an implementation, design, or review agent MUST name that agent's mandatory reading: this README's routed rule files for its task area, the app's counterpart files, and the relevant design or package docs, as explicit paths, read-before-acting. An agent whose prompt lacks its reading list must request it rather than proceed. The orchestrator remains responsible for violations by agents it under-briefed.

## Changing rules

- **Where**: a shared rule changes in ttt-packages (`packages/dev-standards/rules/`) and reaches the apps as a release they adopt; an app rule, addition, or override changes in that app's repo.
- **Add**: next free number in the correct band; update the playbook step that audits it and `playbooks/crosswalk.md` in the same change (RULE-STD-QUALITY-203).
- **Edit**: same ID; a scope change edits its Scope line.
- **Move**: the ID keeps; only the file changes.
- **Promote**: an app rule both apps need becomes shared under a new low number; its `9xx` number is retired.
- **Delete**: a dead rule is removed outright — the whole block goes, with no retired-in-place marker left behind. Its number is never reused, and every reference to it (other rules, playbook steps, design docs, guard-test comments) is updated in the SAME change, so nothing cites an ID that no longer exists; for a shared rule, the release's adoption file names it so each app updates its own references.
- **Conflict** between any two rules, or between a rule and reality: that is a defect — surface it to DJ (RULE-STD-ENG-008). Entry files never override the rules; only DJ's explicit in-conversation instruction does.
