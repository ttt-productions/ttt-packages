# Merge record — how each mixed shared rule is built

For every `RULE-STD-*` rule whose source rulebooks differ, this record says what the shared text
keeps, what each app adds, and what each app overrides. The run's rule-writing groups (1A–1E) author
from it, and a rule they cannot write from it is a stop and a question for DJ. Rules not listed here
have one source, or sources that differ only in product names; their shared text is the ttt-prod (or,
for packages-only rules, the ttt-packages) text made product-neutral.

**How a difference is settled** (DJ's decisions, PLAN.md § Decided):

- **Stricter wins.** Where one rulebook demands more, the shared rule carries the stricter clause, and
  any repo that does not meet it gets catch-up work in the plan (PLAN.md § ttt-prod compliance work).
- **Business relaxations are explicit app overrides.** "Overrides shared `<rule>`: …" in that app's
  addition, never a silent difference.
- **App names are additions**, through the placeholders in the app's values block.
- **Security internals never enter the shared text** (RULE-STD-ARCH-209). Where a ttt-prod rule
  names its own guard modules, provenance arrangement, or emulator gating, the shared rule states the
  general obligation and the specifics stay in ttt-prod's private addition. This record names those
  places without restating them, because this repository is public.
- **The Q-Sports clauses below are quoted** so the run never reads Q-Sports. Q-Sports' compliance
  with the stricter ttt-prod clauses is part of its own conversion.

Legend: **Fold** = a stricter clause added to the shared text. **TTT+** / **QS+** = an app addition.
**QS override** / **TTT override** = an explicit app override. **Scope** = the rule's scope line.

---

## ENG

- **ENG-003, ENG-004, ENG-010.** Shared text is ttt-prod's. The "why" stories (the NCII scanner, the
  parchment agent) are ttt-prod history and become neutral statements of the failure.
- **ENG-011** (promoted from Q-Sports). Applies once `<HOLDS_LIVE_DATA>` is yes. TTT+: not yet; it
  becomes yes at launch. QS+: yes.

## ARCH

- **ARCH-005.** Shared text is the general contract: one shared definition per cross-tree trust
  contract, a pair-proving test, the bounded pre-verification read. TTT+: its trees, its contract
  modules, and its provenance arrangement (kept private).
- **ARCH-006** (promoted). Product-neutral: code adapted from another product carries none of that
  product's identifiers, concepts, or policy values; the `@ttt-productions/*` specifier is the one
  sanctioned occurrence. QS+: copies come from ttt-prod.
- **ARCH-101.** Fold (Q-Sports): "An import between the two app roots (by relative path, alias, build
  step, or copied file) standing in for a q-core definition" is prohibited, and "q-core importing app
  code" is prohibited. Written as: no import between `src/` and `functions/src` standing in for an
  `<APP_DATA_PACKAGE>` definition; the app-data package imports no app code. A pair-proving test that
  imports both sides of a trust contract (ARCH-005) is not such an import.
- **ARCH-103.** Fold: "The one exception is an audit-trail field explicitly named as a snapshot
  (`displayNameSnapshot`); a field named plainly `displayName` is never that exception", and "A read
  path that trusts an embedded name instead of resolving from `publicUsers`" is prohibited. TTT+: the
  four identity sources and its lookup hooks. QS+: ghosts have `publicUsers` documents.
- **ARCH-104.** Fold: path builders are wrapped "never by hand-assembly".
- **ARCH-105.** Fold: also prohibits `FieldValue.serverTimestamp()` and firebase-helpers'
  `serverNow()`; a native-TTL `Timestamp` field is "named for its purpose (`expireAt`), and never the
  source of a displayed or sorted value".
- **ARCH-106.** Shared text is ttt-prod's, with "an explicit admin check" widened to "an explicit
  privilege check" (QS+: admin or referee).
- **ARCH-109** (promoted). Product-neutral: every compound document id has one builder (and a parser
  where parts are read back) in `<APP_DATA_PACKAGE>`; rules files restate it only as a guarded
  declaration. QS+: the `teamMemberships` id.
- **ARCH-202** (merged: app side + packages side). Scope both. Package side: roots server-safe,
  runtime subpaths, optional client peers, no wildcard imports (ttt-packages ARCH-202). App side:
  import from the entry matching the runtime (ttt-prod ARCH-202). Fold (Q-Sports): "q-core's root,
  which Cloud Functions and the browser both import, holds types, schemas, constants, unions,
  builders, and pure functions only" — written as the app-data package's root.
- **ARCH-203** (merged). Scope split: **app code** imports through a folder `index` from outside the
  folder and directly inside it (ttt-prod's one-import-path rule); **package code** imports the
  defining file, never an index (ttt-packages ARCH-203). Both halves keep: no laundering re-export,
  no compatibility barrel, one package entry per definition. QS override: none — Q-Sports adopts the
  one-import-path half in its parity (guard F5).
- **ARCH-204.** Shared: the call-site shape stays; on-disk shape changes ship a migration once
  `<HOLDS_LIVE_DATA>` is yes (ENG-011). TTT+: the pre-launch latitude while the database is wipeable.
- **ARCH-205.** QS+: q-core is one of those packages.
- **ARCH-201, 206, 207, 208** (packages-only). Scope packages; ttt-packages text.
- **ARCH-209** (new). Written from PLAN.md § The rulebook.

## BACKEND

- **BACKEND-001.** Fold: links and callbacks are "derived through one shared URL helper from the
  frontend's `NEXT_PUBLIC_SITE_URL` — never a host written into source or derived from the incoming
  request", and "a URL assembled from string fragments at a call site" is prohibited. `<CANONICAL_ORIGIN>`
  replaces each domain.
- **BACKEND-003.** Fold: "The callable entry takes the caller from `request.auth.uid` through
  `assertAuth` … and hands the core an actor built from it, from which the core derives `callerUid`".
  TTT+: Work-scoped resources through RULE-TTT-BACKEND-901. QS+: team-scoped through RULE-QS-BACKEND-901.
- **BACKEND-004.** Fold: also prohibits "a privileged callable gated only on a route guard or a hidden
  UI control" and "an error message claiming an authority the code does not enforce". The twin-callable
  actor modes are placeholders (`<MEMBER_ACTOR_MODE>`). QS+: referee is a global role.
- **BACKEND-011.** Shared text is ttt-prod's with the participant statuses as examples. TTT+/QS+: each
  app's participant gates.
- **BACKEND-012** (promoted). Shared: a privileged request handler outside the callable boundary
  carries the callable obligations (strict schema, server-derived identity, the attestation its design
  names through one shared guard module, fail closed, emulator-flag-only relaxation). TTT+: its routes,
  its guard module, and what each one attests (private).
- **BACKEND-013** (promoted). Shared: each named surface class carries a deliberate rate-limit
  decision through the canonical limiter, or an in-file decision naming the primary defense. TTT+: its
  limiter modules and presets. **QS override:** "Q-Sports runs no request rate limiter: its abuse
  posture is App Check attestation plus the server-side auth and role assertion every callable runs.
  Adopting a limiter is a product decision DJ makes, and the limiter then follows the shared rule."
- **BACKEND-102.** Fold: "client-chosen **or caller-reconstructable** ID"; compound ids (ARCH-109) are
  reconstructable by any caller.
- **BACKEND-105.** TTT+ / QS+: which top-level documents are readable by whom.
- **BACKEND-106.** Shared: every user-generated or admin-entered write goes through a callable. TTT+ /
  QS+: their surfaces.
- **BACKEND-108.** TTT+ / QS+: their bucket contents.
- **BACKEND-109.** Fold: "A rules role check reads the same truth the callable reads … never a copied
  roster field" (written: never a denormalized copy of the membership or role).
- **BACKEND-112.** ttt-prod's text; Q-Sports' "why" adds nothing new.
- **BACKEND-114.** Fold: a script reaching a real project "takes its target project explicitly at
  invocation (never a project id in source), takes its credential from the one owner". TTT+: its
  credential resolver. QS+: its own.
- **BACKEND-115.** TTT+ / QS+: each app's enforcing guard wiring.
- **BACKEND-117.** ttt-prod's text; examples neutral.
- **BACKEND-119.** Shared: ttt-prod's text without its money example. **TTT override:** the pledge
  money totals take a signed delta (each delta from the pledge's own transactional read); a damaged
  total is investigated from the ledger (the scheduled drift check is a do-later item). **QS
  override:** "stat aggregates are outside this rule — they are derived from events and finalized
  games, never decremented by hand".
- **BACKEND-120** (ttt-prod BACKEND-120 + Q-Sports QUALITY-010). ttt-prod's text (it also requires
  fixtures seeded through `withSecurityRulesDisabled` and no assertion inside it).
- **BACKEND-201.** Shared: the definition of sensitive state. TTT+ / QS+: each app's list.
- **BACKEND-202.** **QS override:** "A stat event document is itself the audit record of the click
  that wrote it … so the scoring core writes no separate audit event per click. Every other stats
  action … writes its event."
- **BACKEND-203.** Fold: "a backup, restore, or migration path that rewrites audit documents" is
  prohibited. TTT+: the admin site-copy exception.
- **BACKEND-204.** Fold: "recording only the error and dropping the actor or the target" is prohibited.
- **BACKEND-205.** Fold: "an actor copied from `request.data`" is prohibited. Actor modes are
  placeholders.
- **BACKEND-206.** Shared: projections and read models are written only by the path that writes their
  source; the rules deny the client write path outright (Q-Sports' text). TTT+: moderation cascades,
  restore manifests, hide provenance, hidden content never seeding an action. QS+: ghosts' `publicUsers`.
- **BACKEND-210.** Shared: an account holding admin standing is never restricted (ban or any status
  restriction) through any writer; the roster is read in the status transaction. TTT+: suspend and
  under-13 closure, and the safety-lock exception.
- **BACKEND-211.** Shared: one audit writer, origin from the request, person-actors built only by the
  constructors. TTT+: the take-it-down and deferred-decision exceptions, sign-in recording, no
  Identity Platform blocking functions.
- **BACKEND-212** (promoted). Product-neutral. Scope note: rebuilding a derived copy from an
  untouched source is not a repair of a completed record.
- **BACKEND-301.** ttt-prod's text (no `void` call is sanctioned). Q-Sports' "the one sanctioned
  `void` call" is dropped; Q-Sports complies in its conversion.
- **BACKEND-302.** Fold: "a comment promising the work 'can be retried' with nothing that retries it".
- **BACKEND-303.** Fold: "a raised `maxInstances` without a measured reason" is prohibited.
- **BACKEND-305.** Shared: the verb prefixes and one callable per action; deployed names are frozen
  once `<HOLDS_LIVE_DATA>` is yes. TTT+: `seed*`, the frozen legacy `manage*`. QS+: the stats verbs.
- **BACKEND-306.** Shared: one notification system, the sanctioned creation lanes listed in the app
  addition, one ledger, one materializer, no client writes; an inline post-commit delivery attempt
  never substitutes for the durable row (Q-Sports' fold). TTT+: two lanes (reliable occurrence +
  fanout). QS+: one lane; "Q-Sports notifications are shared admin cards, so there is no
  multi-recipient fanout lane."
- **BACKEND-307.** TTT+ / QS+: each app's external services.
- **BACKEND-308, 309, 310.** ttt-prod's text, examples neutral; BACKEND-308's emulator specifics are
  TTT+ (private).

## FRONTEND

- **FRONTEND-001.** ttt-prod's text (it names ui-core's `ActionRow`, a package component both apps
  use). Fold: "table" in the pattern list.
- **FRONTEND-002.** Fold: every `overrides.css` rule names the utility it beats; one `@source` line per
  class-rendering package.
- **FRONTEND-003.** Fold: "a color value that does not exist yet is added to `brand.css` first", a
  Tailwind palette class is prohibited, and "a theme-varying token is declared in all three" theme
  blocks. TTT+: its theme names and the parchment/ink family.
- **FRONTEND-006.** Shared: icon swap, red only in the dialog confirm. TTT+: the follow and like icons.
- **FRONTEND-007.** Fold: every branch of a page (loading, empty, error) renders inside the page
  container; "a per-call-site `truncate` / `line-clamp` / `max-w-[…]` standing in for the shared class"
  is prohibited; "where the truncated text is the record's only identification the full value stays
  reachable through its accessible name or title".
- **FRONTEND-008.** Fold: `brand.css` holds tokens only; "Changing a `@ttt-productions/*` package to
  alter a <APP_NAME>-only look" is prohibited.
- **FRONTEND-010.** TTT+ / QS+: each app's device-local list and sanctioned mirror.
- **FRONTEND-101.** TTT+: its query defaults.
- **FRONTEND-102.** Fold: "each queryable scope has exactly one builder (no aliases)", no key-prefix
  literal at a call site, and "Cache keys are app-local: they never cross into q-core or server code"
  (written: into `<APP_DATA_PACKAGE>` or server code).
- **FRONTEND-103.** TTT+: the Work-leave scoped cancel.
- **FRONTEND-104.** Fold: "a client write helper standing in for a callable".
- **FRONTEND-105.** ttt-prod's text (declarations, factory kinds, policy). Fold: "a callable name as a
  bare string at a call site". Q-Sports adopts ttt-prod's shape in parity (A2).
- **FRONTEND-106.** Fold: identity, claims, and auth loading come from the one auth-core provider
  through one accessor; no `useEffect` + router redirect standing in for the gate; the boundary never
  stays loading forever; no second auth context, claims parser, or profile listener. TTT+: `AuthGate`.
- **FRONTEND-108.** Fold: "a continuation that runs after an awaited hop captures the uid when its
  attempt starts and re-checks it through `isSessionOf` … before every later step, toast, or
  navigation".
- **FRONTEND-109.** ttt-prod's text (declared readers).
- **FRONTEND-110.** TTT+ / QS+: each app's predicate examples.
- **FRONTEND-201.** ttt-prod's text (its primitive list).
- **FRONTEND-202.** Fold: `window.confirm()` is prohibited as a gate; a reason a repair requires
  (BACKEND-212) is gathered by the dialog, never re-implemented beside it. TTT+ / QS+: examples.
- **FRONTEND-203.** TTT+ / QS+: each app's shell file.
- **FRONTEND-206.** Fold: "A read that answered and then fails keeps its answer: the hook hands back
  the last answered data with the failure beside it, and the surface keeps that content — and every
  editor open in it, with its input — on screen with the failure inline; only a failure with nothing
  answered replaces the content", "An answered empty result renders the canonical empty state", and
  "a query surface with a loading branch and no error branch" is prohibited.
- **FRONTEND-204, 205, 207.** ttt-prod's text; app examples neutral.

## MEDIA

- **MEDIA-001.** TTT+: admin/non-admin origins, the `ncii-evidence` exception. QS+: signature origins.
  Fold: "<APP_NAME> domain naming … inside a generic upload package" is prohibited.
- **MEDIA-002.** Fold: "No other segment — filename, entity id, … — comes from the client", and the
  accepting callable "checks the object's real Storage metadata against the origin's spec before it
  records anything". Builder and spec names are placeholders.
- **MEDIA-004.** Fold: "Processed derivatives, the fields that point at them, and every `*ProcessedAt`
  marker are written only by the backend."
- **MEDIA-006, 008, 010.** Names are placeholders; QS+: signature origins, its tray, its deferred field.
- **MEDIA-101.** Shared: one app renderer around media-viewer, built at render time, never a raw
  element. Fold: "a URL hand-built outside the canonical builder", "a raw upload path as the display
  source", and showing the original when a processed size is missing are prohibited. TTT+:
  `AppMediaPreview`, the gateway, the documented exceptions. QS+: `Picture`.

## QUALITY

- **QUALITY-003.** TTT+: `e2e/flaky-log.md`.
- **QUALITY-004.** Fold: "a spec that reseeds or clears emulator data" is prohibited.
- **QUALITY-006** (apps + packages). Scope split: **apps** — zero suppression; "a `warn`-level finding
  is a finding to fix", and turning a rule off or widening `ignores` to pass failing code is prohibited
  (Q-Sports' fold); **packages** — a reasoned `eslint-disable-next-line` for a narrow intentional case.
- **QUALITY-009, 010** (ttt-prod 009/010 = packages 008/009). ttt-prod's text; scope both.
- **QUALITY-011** (promoted from Q-Sports QUALITY-009). Product-neutral; scope both.
- **QUALITY-101.** Fold: "Monitoring is a no-op under the emulator and in tests", "a second monitoring
  initialization" is prohibited. TTT+: its init modules.
- **QUALITY-102** (merged). Scope both: generic packages and the app-data package stay
  monitoring-agnostic; each app binds monitoring once per runtime in thin adapters. TTT+: its adapter
  list and scrubber hooks.
- **QUALITY-103, 105, 107.** ttt-prod's text; owners are placeholders. QS+: its owners.
- **QUALITY-104.** TTT+ / QS+: which notification lanes model it.
- **QUALITY-106.** Shared: the policy; the app's diagnostic-key constant is `<APP_TELEMETRY_POLICY>`.
- **QUALITY-201, 202, 203, 205.** ttt-prod's text; scope both. QUALITY-203's "hygiene playbook step"
  becomes "the owning shared playbook step, or the app's addition step".

## COMMENT

- **COMMENT-001.** The list of rules requiring a comment is rebuilt from the new IDs.
- **COMMENT-004.** Fold: "plan step names used as labels".
- **COMMENT-010.** **TTT override:** each public-document seed file names `docs/ttt-prod-legal/` as
  the source of its words.
- The fix-on-touch paragraph is deleted (PLAN.md § Decided).
