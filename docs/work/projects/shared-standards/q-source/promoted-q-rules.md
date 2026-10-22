# Q-Sports rule texts promoted to shared

Copied from Q-Sports' rulebook so the run can write the shared versions without reading Q-Sports. Each becomes the RULE-STD ID shown, rewritten product-neutral (placeholders, Q-Sports specifics moved to a Q-Sports addition).

## Q-Sports ARCH-006 → RULE-STD-ARCH-006 — ttt-prod code is adapted, never carried with its identity

**Rule.** ttt-prod and `ttt-packages` are the read-only source Q-Sports copies from (ttt-prod read only once DJ has said so in the conversation — the workspace router). What crosses is the mechanism, renamed and adapted to Q-Sports' domain, paths, and rules; what never crosses is a TTT identifier — no `ttt`/`TTT` prefix on a symbol, file, CSS class, env var, collection, or string, no TTT domain concept, and no TTT policy value carried because it was in the source. The `@ttt-productions/*` package specifier is the one sanctioned occurrence. A generic mechanism both apps need goes into a shared package (ttt-packages ARCH-201, ARCH-205) rather than being copied twice.

**Why.** A copied identifier is a second name for a TTT concept living in a product that has no such concept, and it is the tell that the code was pasted rather than understood — the next reader keeps the name, the drift compounds, and the mechanism that should have been a package is now two copies.

**Prohibits.**
- A `ttt`-prefixed symbol, class, file, env var, or string in `src/`, `functions/src/`, `e2e/`, or the rules files, other than an `@ttt-productions/*` import.
- A TTT domain concept (guild, realm, work project, pledge, stake share, bouquet) in Q-Sports code.
- Copying a mechanism into both apps when it belongs in a shared package.

**References.** ENG-002, ENG-004; ttt-packages ARCH-201, ARCH-205; `codebase-hygiene-playbook.md` step 29.

## Q-Sports ARCH-109 → RULE-STD-ARCH-109 — Compound document IDs have one builder and one parser

**Rule.** Every compound document ID format is owned by a single builder in q-core, with a matching parser wherever code needs the parts back. `teamMemberships` uses `{leagueId}_{teamId}_{uid}`; every producer and consumer — app code, Cloud Functions, `firestore.rules`, and test fixtures — goes through that builder (the rules file restates the declaration it spells, pinned by a guard). The format is never assembled inline and never taken apart with an ad-hoc split at the call site.

**Why.** The membership id is load-bearing for authorization — code and rules read a membership document by id to decide whether the caller holds a team role — so one inconsistent copy is a permission failure, not a cosmetic one.

**Prohibits.**
- An inline template literal or a local `membershipId()` helper for a compound ID.
- Parsing a compound ID by splitting on the separator at the call site.
- A second ID convention for one relationship.

**References.** ENG-002, ENG-011 (an ID convention change ships its migration); ARCH-004, ARCH-101, ARCH-104; [../../design/leagues-teams-and-roles.md](../../design/leagues-teams-and-roles.md); `src/__tests__/lib/hygiene-guards.test.ts` (the compound-id guard); `data-integrity-playbook.md` step 3.

## Q-Sports BACKEND-212 → RULE-STD-BACKEND-212 — Repair actions record a reason and the state they replaced

**Rule.** An admin action that changes a completed record — reopen, any `recalculate*`, backfill, a data migration, a backup restore, a bulk delete — requires a caller-supplied reason and records the prior state alongside the new one: which documents it touched, what the affected aggregates were before, and what they became. Repair actions are audited even when they are idempotent. Removing records that never held a stat — a never-played ghost, a never-played team — is not a repair: it takes no reason, and its audit event still records who removed what. Linking a ghost to its real account takes no reason either — the admin chooses the account and confirms — and its audit event still records who linked which ghost to whom, what moved, and every destination's before and after, even when the link is resumed.

**Why.** A repair that replaces an aggregate destroys the only evidence of what the record used to say, so a wrong one is indistinguishable afterward from a legitimate correction.

**Prohibits.**
- A repair callable with no required reason argument.
- Replacing an aggregate without recording the value it replaced.
- Treating "the numbers can be recalculated" as a substitute for recording the change.

**References.** [../../design/sports-stats-contract.md](../../design/sports-stats-contract.md); BACKEND-202; SPORT-201, SPORT-206; `callable-functions-playbook.md` step 13.

## Q-Sports ENG-011 → RULE-STD-ENG-011 — Q-Sports is live; persisted shapes change with a migration path

**Rule.** Any change to a persisted shape — Firestore field, document ID convention, custom claim, Storage path — ships with the migration bringing existing documents to the new shape; a change that runs against live documents before its migration completes also ships a read path tolerating both shapes until it does. Migrations are idempotent, safely re-runnable, and belong to the work that forces them.

**Why.** Production holds real leagues, users, and historical stats with no wipe available: a shape change without a migration silently breaks live records, and a migration that cannot be re-run cannot be recovered when it fails halfway.

**Prohibits.**
- A new field shape while old documents hold the old one and no migration or tolerant read covers them.
- A migration that corrupts or double-applies when re-run.
- Deferring the migration while the writing code ships now.

**References.** BACKEND-104, BACKEND-114; ARCH-204; QUALITY-001; `data-integrity-playbook.md` step 12.

## Q-Sports QUALITY-009 → RULE-STD-QUALITY-011 — `test:quiet` is the canonical gate; a stage named by hand never skips

**Rule.** `test:quiet` (`scripts/test-quiet.mjs`) is the one command that verifies a change set, running every declared stage, with targeted `--only <stage>` variants for focused runs. A hand-assembled npm sequence is not a substitute, and new verification is added as a stage of this gate rather than as a second command — structural guards run inside its `vitest` stage, rules assertions in its `rules` stage. The `rules` and `e2e` stages need the `dev:e2e` stack: a full run with the stack down skips them (⊘) and passes on the stages it ran, which is the Normal Q-Sports Test Flow's first step before `dev:e2e` starts; a run that names them (`--only rules|e2e`, `test:quiet:rules`, `test:quiet:e2e`, `test:quiet:live`) fails with the stack down, naming the missing services. The stage list lives in the script and its design doc, not restated here (QUALITY-202).

**Why.** One command run the same way by everyone is the only way a green result means the same thing twice; assembling stages by hand silently drops the ones that were inconvenient that day. A live stage asked for by name and skipped would read as verified while nothing ran.

**Prohibits.**
- Declaring a change set verified from a hand-assembled sequence, or the live stages verified from a full run that skipped them.
- A live stage named in `--only` reported as a skip.
- A second parallel gate command instead of a new stage in this one.

**References.** `scripts/test-quiet.mjs`; [../../design/verification-gate.md](../../design/verification-gate.md); QUALITY-002, QUALITY-003; `testing-coverage-playbook.md` step 2.
