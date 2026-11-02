# Every stored-document schema is plain, held by a guard

**What:** Every stored-document schema in both application-data packages reads plain (a field it
does not name is dropped on read, never refused), the shared rulebook says so, and a repo-guards
guard fails the build on a `.strict()` stored-document schema. Callable input stays strict.
**Severity:** medium
**Came from:** DJ, in the Q-Sports 2.0 migration orchestrator, after a Q-Sports build session found
the invitation schema plain while other stored schemas are strict.

## DJ's decision

One way, in every app: **callable input is strict** (RULE-STD-BACKEND-002, unchanged); **every
stored-document schema is plain**; what gets written is held by RULE-STD-BACKEND-115 and the write
guard, which already let a write store only declared fields. A plain stored schema means a field
the code no longer knows — left on live data after a field is removed — is dropped on read instead
of making the document unreadable.

## As it is today (checked in the code)

- No rule, shared or either app's, says how strict a stored-document schema is. RULE-STD-BACKEND-002
  makes callable input `.strict()`; RULE-STD-BACKEND-115 covers what a write stores.
- Both packages mix the two in `src/doc-schemas/`: q-core has about 28 `z.object(` and 70
  `.strict()` / `strictObject`; ttt-core about 153 and 148, plus 2 `passthrough` / `looseObject`.
  Plain in q-core: the core documents (invitation, join request, membership, free agent, games,
  leagues, teams, profiles, gallery, waivers, the audit event, system config). Strict in q-core: the
  stats side, stats operations, the migration console, the roster-sync record, the status-reconcile
  queue, catalogs. ttt-core: older systems plain, newer ones (safety, NCII, media assets, chat sync,
  public documents) strict.

## The work

1. **The rule, in `@ttt-productions/dev-standards`:** unless that package already says it, the shared
   rulebook in `packages/dev-standards/rules/` states it (a clause with RULE-STD-BACKEND-115, or a
   new rule in its band), with the playbook step and `playbooks/crosswalk.md` updated in the same
   change (RULE-STD-QUALITY-203). dev-standards is released with the rest of the batch, and both apps
   adopt it.
2. **The guard:** repo-guards gets a guard that fails a `.strict()` / `strictObject` schema reachable
   from an app's stored-document registry, with its fixture tests, and each app's guard config names
   its registry.
3. **q-core:** every strict stored-document schema becomes plain; one release.
4. **ttt-core and ttt-prod:** an adoption file for ttt-prod carries the guard and ttt-core's
   conversion to plain (ttt-core follows ttt-prod's rulebook).
5. **Q-Sports adoption:** install, the guard config, and the guard green.

A shape used both as callable input and as a stored document (ttt-prod's persisted `MentionSchema`
is one) is settled with DJ when the builder finds it, never decided alone.

**Done when:** dev-standards' shared rulebook says it and that release is installed in both apps,
the guard runs in both apps, q-core has no strict
stored-document schema and Q-Sports' guard is green, and ttt-prod's adoption file is written.
