# Shared base — every repo's `CLAUDE.md`

Each repo's `CLAUDE.md` holds its values block, its own facts, and one import of this file. This
file holds what every repo shares: the Claude Code preferences pointer, the mandatory reading, the
`docs/work/` and project rules, the shared-package release and adoption steps, and the Normal Test
and Dev Flows. ttt-packages imports it too.

## Placeholders

The shared docs name repo-specific values by placeholder. The repo's `CLAUDE.md` declares every
value once, in a block at its top, and every shared doc's placeholders are read as those values;
nothing is rewritten at install time. A value of **none** means the repo has no such thing, and a
sentence or section that needs it does not apply there. The placeholders the AI docs use:

| Placeholder | Meaning |
|---|---|
| `<APP_NAME>` | The product's name as prose, flow names, and kickoff lines use it. |
| `<APP_REPO>` | The app's checkout folder. |
| `<PACKAGES_REPO>` | The ttt-packages checkout folder (in ttt-packages: this repo). |
| `<DEV_STANDARDS>` | This package's root as the repo reads it: the installed copy in an app, the source folder in ttt-packages. |
| `<APP_RULES>` | The app's own rulebook folder: its business rules and its additions and overrides on shared rules. |
| `<APP_DATA_PACKAGE>` | The app's application-data package, which follows the app's rulebook. |
| `<ADOPTION_APP>` | The app's folder name under `<PACKAGES_REPO>/docs/work/adoptions/`. |
| `<INSTALL_FOLDERS>` | Every consuming folder besides the root that declares an `@ttt-productions/*` package. |
| `<DESIGN_DOCS>` | The design docs a task reads for the system it touches. |
| `<TERMINOLOGY_DOC>` | The doc that holds the settled terminology. |
| `<DEV_E2E_LAUNCH>` | Where the repo writes how `dev:e2e` is launched on this machine. |
| `<HOSTED_E2E_DOC>` | The hosted end-to-end run doc. |
| `<HOSTED_DEV_URL>` | The hosted dev site a walkthrough browses. |
| `<APP_WORKFLOWS>` | The app's own folder for a workflow only that app has. |
| `<REFERENCE_PRODUCT>` | The other product whose mechanisms this one adapts, with its checkout folder; read only on DJ's grant (the workspace router). |

### Rule and playbook placeholders

The shared rules and playbooks use these too; each has a value in the same block.

| Placeholder | Meaning |
|---|---|
| `<CANONICAL_ORIGIN>` | The app's one canonical public origin; every link, callback, and redirect uses it. |
| `<HOLDS_LIVE_DATA>` | **yes** once the app's database holds data that must survive (no more wipes), **no** before. |
| `<MEMBER_ACTOR_MODE>` | The audit actor mode for a member acting inside a shared resource they belong to. |
| `<CALLABLE_DECLARATIONS>` | The one file that declares every callable the client invokes. |
| `<CALLABLE_POLICY>` | The app's one callable policy: its error taxonomy, describe function, classifier, and predicates. |
| `<CALLABLE_ERROR_EXIT>` | The app-local catch-block exit every callable's error path goes through. |
| `<DESIGNED_ANSWER_PREDICATE>` | The one backend predicate that decides a designed callable refusal. |
| `<QUERY_KEYS_MODULE>` | The one file holding every query-key builder. |
| `<DOMAIN_EVENT_REGISTRY>` | The one file that owns cache invalidation; mutation hooks notify it of their domain event. |
| `<SESSION_RETIREMENT_OWNER>` | The one owner that retires a session's listeners, reads, and query cache when it ends. |
| `<QUERY_ERROR_REPORTER>` | The one query-layer monitoring capture for read failures. |
| `<READ_STATE_MODULE>` | The module that renders a read's pending, failed, empty, and content states. |
| `<LOAD_ERROR_STATE>` | The one rendered read-failure component. |
| `<LOADING_STATE>` | The one canonical pending-state component. |
| `<INTERACTIVE_PENDING_LAYER>` | The shared layer for per-row and unmount-surviving pending state. |
| `<APP_ASYNC_ACTION>` | The hook that runs async work that is not a mutation, with its pending and failure. |
| `<ASYNC_ACTION_ERROR_HANDLER>` | The capture owner for an app async action's failure. |
| `<AUTH_FAILURE_CAPTURE>` | The capture owner for a Firebase Auth operation's failure. |
| `<APP_TELEMETRY_POLICY>` | The app's telemetry content policy in `<APP_DATA_PACKAGE>`: its diagnostic keys and context. |
| `<NAVIGATION_HELPER>` | The one in-app navigation helper: its link, `navigate()`, hard navigation, and reload. |
| `<UPLOAD_PATH_BUILDER>` | The staging upload path builder in `<APP_DATA_PACKAGE>`. |
| `<MEDIA_SPECS>` | The per-origin media spec map in `<APP_DATA_PACKAGE>`. |
| `<FILE_ORIGIN_SCHEMA>` | The schema of canonical file origins in `<APP_DATA_PACKAGE>`. |
| `<PROCESSOR_ROUTER>` | The function that routes an upload to its processor. |
| `<GUARD_SUITE>` | The command that runs the repo's guard tests; `-t "<title>"` runs one. |
| `<SERVER_MODULE_GLOBS>` | `rg` exclusion globs for the app's server-only module trees under `src`. |
| `<FUNCTIONS_TEST_SAMPLE>` | One folder under `functions/src` that holds tests, for the run-location check. |
| `<APP_SCHEMA_DIR>` | The source folder of `<APP_DATA_PACKAGE>`'s document schemas. |
| `<FIELD_LINEAGE>` | The command that prints a field's lineage. |
| `<COMMENT_TREES>` | The space-separated trees the comment audit reads. |
| `<APP_VOCABULARY_PATTERN>` | A regex of the app's domain words, which no generic package may contain. |

**Additions and overrides.** A repo adds to a shared doc in its own file, under an
"`<APP_NAME>` additions" heading, and overrides shared text only explicitly: "Overrides shared
`<doc>` § X: …". An unstated difference is drift.

## Claude Code preferences

If this is a Claude Code session, read and FOLLOW the preferences in
`~/.claude/projects/C--DjDev/memory/MEMORY.md` (Claude-Code-only; Claude web has its own).

## Mandatory reading — every conversation

The engineering rules govern how the software is built. The shared rulebook
(`<DEV_STANDARDS>/rules/`) holds every rule the products and packages share, each stating its scope;
the app's own rulebook (`<APP_RULES>`) holds only its business rules and its additions and overrides
on shared rules, and `<APP_DATA_PACKAGE>` follows it. Rules are not optional and never "remembered"
from a past task.

- **Every conversation**: read `<DEV_STANDARDS>/development-preferences.md` — how an AI works with
  DJ. Nothing in it is repeated here.
- **Every conversation** — review, investigation, planning, docs, testing, or implementation: read
  the shared `<DEV_STANDARDS>/rules/README.md` and `<DEV_STANDARDS>/rules/core-rules.md`, then the
  app's own `<APP_RULES>README.md` and `<APP_RULES>core-rules.md`, before acting.
- **Focused work**: also read the routed area files per the shared README's routing table —
  `architecture/`, `backend/`, `frontend/`, `media/`, `quality/`, `comments/` — in both rulebooks.
  Tasks route to every area they touch (a media upload change routes to all six; a CSS-only fix
  routes to frontend + quality + comments).
- **Work involving a system**: read `<DESIGN_DOCS>` for the system model, then inspect the current
  code — code is the implementation truth. Code/doc disagreement is surfaced, never silently resolved
  (RULE-STD-ENG-008).
- **Spawning any agent (RULE-STD-ENG-010)**: every prompt that spawns an implementation, design, or
  review agent MUST name that agent's mandatory reading — the routed rule files of both rulebooks for
  its task area plus the relevant `<DESIGN_DOCS>`, as explicit read-before-acting paths. An
  under-briefed agent requests its reading list rather than proceeding; the orchestrator owns the
  violation. Every review agent's prompt also requires it to check each new or changed test against
  the business rule it claims to prove and to report a test written to pass (RULE-STD-QUALITY-001;
  `<DEV_STANDARDS>/playbooks/testing-coverage-playbook.md`).

The repo's `CLAUDE.md` is a lightweight entry point: values, repo context, commands, environment
facts, and boundaries. It is not a rulebook — the engineering rules own every must/never engineering
requirement.

## Documentation and work

ALL work to do — findings, decisions waiting on DJ, work waiting to be implemented, parked work,
blocked work, human actions, and projects — lives in the repo's `docs/work/`;
`<DEV_STANDARDS>/work/README.md` says how work moves between its folders. The development workflows
(named, AI-specific conversation types DJ starts) live in `<DEV_STANDARDS>/workflows/`. Read the
relevant docs before working an area.

A design ruling is written to its owning doc the same session: built → its design doc
(`<DESIGN_DOCS>`); not yet built → `docs/work/do-later/`. Settled terminology lives in
`<TERMINOLOGY_DOC>`.

**Projects.** A project's `docs/work/projects/<project>/PLAN.md` is the living source of truth for
that project's work. Steps are NAMED (never numbered, never renumbered), executed top-to-bottom; a
step that needs one has a folder beside the plan at `docs/work/projects/<project>/<step-name>/`.
Before starting a project's work:

1. Read the project's `PLAN.md` and find the step DJ named (or ask which step).
2. Read that step's folder before designing — the work doc is the detail; the plan is only the map.
3. Work one step (or one focused slice of a step) per conversation — context limits force messy
   partial results otherwise.
4. When an item completes, delete it from the step's work doc. When a step completes, delete its
   folder AND its section in the project's `PLAN.md`. Never renumber anything — there are no numbers.
5. Never add items to a project's `PLAN.md` from a conversation unless they are scope expansion for
   the current step.
6. `[OVERNIGHT-OK]` steps may relax the no-commit rule ONLY per the protocol written in that step's
   work doc (dedicated branch, checkpoint commits, never main, never push, never publish).

## Shared-package releases and adoption

### Adoption files

Every release of an `@ttt-productions/*` package hands its adoption to each app through a file in
`<PACKAGES_REPO>/docs/work/adoptions/<app>/`.

- **The package session writes them.** In the same change as the package edit, before the release
  command, it writes one adoption file per released package for each app — except an app-data
  package, whose file goes only to its own app. A package session cannot see which packages the
  other product installs, so every other released package gets a file for every app.
- **The version it names** is the version the release will publish: one patch above the package's
  `package.json` version before the release.
- **The file** is one item in the `docs/work/` item format (`<DEV_STANDARDS>/work/README.md`) —
  **What:** a very high-level line on what changed; **Came from:** the package session — and its
  body names the package and version, the release it ships in (the release command's folder list),
  what the app must change (often only the install), and how to know it is done.
- **The app session adopts them.** At the start of any app session, and after every install, the
  session lists `<PACKAGES_REPO>/docs/work/adoptions/<ADOPTION_APP>/` and tells DJ what is there.
  It adopts nothing until DJ says go. Inside the Normal Dev Flow, DJ's publish is that go for the
  files the release wrote. Adopting a file: the install (Normal Dev Flow step 5) confirms the
  lockfile names at least the file's version — a lower installed version is a stop, and DJ hears
  which package — then the session does the file's work and deletes the file. A file for a package
  the app does not use is deleted.

### First-time publish of a new package

Publishing runs through npm Trusted Publishing (`.github/workflows/publish.yml`), and npm attaches a
trusted publisher only to a package that already exists. So a package that has never been on npm
gets one manual first publish; it is setup, not a release, and every publish after it is the release
command (`./scripts/release-multiple.sh`, Normal Dev Flow step 4). With the new package built and
`npm run test:quiet` green, hand DJ the steps in order:

1. From the ttt-packages root, DJ runs `npm publish --access public --workspace @ttt-productions/<folder>`
   (its own fenced `bash` block). It publishes the package's current `package.json` version. That
   manual tarball skips CI's `pin-internal-deps` step, so its internal `@ttt-productions/*` ranges are
   the source's `"*"`; step 3 replaces it as `@latest`, and nothing installs it in between.
2. On npmjs.com, DJ opens the new package → **Settings** → **Trusted Publisher**, and under
   **Select your publisher** clicks **GitHub Actions**. He fills in:
   - **Organization or user:** `ttt-productions`
   - **Repository:** `ttt-packages`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** left blank
   - **Allowed actions:** allow direct publishing with `npm publish`. `publish.yml` publishes with
     `npm publish`, and a publisher allowed only `npm stage publish` (the always-on default) fails
     every release. **Allow npm dist-tag** stays off.

   Then he saves. npm does not check the setup when it is saved; a mistake shows only as a failed
   publish in step 3. The setup expires unless a publish through it succeeds within 2 days, so step 3
   follows right away.
3. DJ runs the normal release command, `./scripts/release-multiple.sh <folder> patch`, with the new
   package's folder (alongside any other package in the batch). That release is the version
   consumers install. If its `publish.yml` run fails at `npm publish`, the trusted-publisher fields in
   step 2 are the first thing to check.

The session waits for DJ to say step 3 is published, then follows the Normal Dev Flow from its
step 5.

## The Normal `<APP_NAME>` Flows (named workflows — "do the normal dev/test flow" resolves HERE)

These two named flows are the standing default for how work in these repos is verified and
sequenced. They are DEFAULTS, not cages: DJ may override any step with explicit in-conversation
instructions (e.g. "do the normal test flow, but WAIT for my go before starting dev:e2e — I'm
using the machine"), and an override governs exactly what it names, nothing more. A repo changes a
flow only under its `<APP_NAME>` additions heading. In a repo whose `<APP_NAME>` is none
(ttt-packages) the Test Flow does not apply — its gate is its own `CLAUDE.md` § Verification — and
the Dev Flow's steps 1–4 are its whole share.

**Normal `<APP_NAME>` Test Flow** (how a finished change set gets verified):

0. **Precondition gate — do not start ANY test:quiet stage while blocked.** Known-bad code, a
   needed `@ttt-productions/*` package change, or an open question for DJ each mean: surface the
   blocker and STOP. Gates run only on a change set believed complete.
1. `npm run test:quiet` green (rules/e2e auto-skip without the stack).
2. Claude starts `npm run dev:e2e` ITSELF (the detached launch in `<DEV_E2E_LAUNCH>` —
   Claude-operated as part of this flow; DJ must be logged into the Firebase CLI, and a login failure
   is a stop-and-ask).
3. `npm run test:quiet:rules` and `npm run test:quiet:e2e` green (`test:quiet:live` is an
   acceptable combined form) — zero failures AND zero retry-passes (RULE-STD-QUALITY-003).
4. An app/Functions code change mid-flow invalidates the running build: `npm run dev:kill`,
   re-green `test:quiet`, then start a FRESH `dev:e2e` and rerun the live stages
   (RULE-STD-QUALITY-008 — Claude operates the restart).
5. Kill `dev:e2e` when done and STOP — wait for DJ's push.

**When the session is orchestrating agents, stages 2–5 belong to ONE agent, never the orchestrator.**
That agent starts `dev:e2e`, runs the live stages, fixes root causes (restarting the stack per stage
4), and kills it; the orchestrator only takes its report. "Claude-operated" here means that agent.

Not part of this flow: hosted-dev E2E runs (always separately commanded — `<HOSTED_E2E_DOC>`) and
`npm run dev:local` (DJ's manual dev surface).

**Normal `<APP_NAME>` Dev Flow** (how a change set that spans both repos is sequenced):

1. ALL `@ttt-productions/*` package work first, in `<PACKAGES_REPO>`.
2. The adoption files for every package the release will carry (§ Adoption files), in the same
   change as the package edit.
3. ttt-packages `npm run test:quiet` green.
4. Hand DJ ONLY the release command (`./scripts/release-multiple.sh <folders…> patch`, its own fenced
   block) — then STOP. No install commands: Claude does the installs.
5. DJ runs the publish and says so. Claude then starts a 20-minute clock and checks npm every 30
   seconds until every released package's new version is the `@latest` on npm; then Claude runs the
   installs itself (`@latest --prefer-online`, at the root and in every consuming folder that declares
   the package — `<INSTALL_FOLDERS>`), confirms each lockfile names the new version, adopts the
   adoption files (§ Adoption files), and continues straight into the app work with no further go.
   While it polls, the session works on whatever does not depend on the release — the publish-wait
   overlap in `<DEV_STANDARDS>/development-preferences.md` § Shared-package publish.
   A version still missing from npm after 20 minutes = stop and tell DJ which package; never install
   anything but the published version.
   **What "published" means, and what to poll for.** When DJ says "published" (or "publish is
   running"), he has just RUN the release command: the script is still running and the packages are
   still building, so nothing may be on npm yet, and the version numbers in the checkout may not be
   bumped yet. `release-multiple.sh` first runs its `test:quiet` preflight (minutes); then, per package,
   `release-package.sh` bumps the version, commits `Release <pkg> vX.Y.Z`, tags it, and pushes; the
   tag triggers ttt-packages' `publish.yml` GitHub Actions job, which builds and publishes to npm. So
   the version to wait for is the NEW one — one patch above the package's `package.json` version
   before the release, or the version its `Release <pkg> v…` commit names once that lands — never the
   `package.json` version in the checkout at the moment DJ speaks, which can still be the old one
   (compared against npm `@latest`, it reads a stale match as "live"). A version is available only
   when npm `@latest` names it AND its tarball
   (`https://registry.npmjs.org/@ttt-productions/<pkg>/-/<pkg>-<version>.tgz`) answers 200: the
   registry can report the new `@latest` minutes before it serves the tarball, and an install in that
   gap fails `E404`.
6. All `<APP_NAME>` work; when the entire change set is done, run the Normal `<APP_NAME>` Test Flow.
7. Stop and wait for DJ's push.
