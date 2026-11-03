# Adopt @ttt-productions/dev-standards 0.0.28

**What:** the shared rules gain one naming grammar for callables, audit and domain events, query-key scopes and hooks.
**Severity:** medium
**Came from:** the Q-Sports naming-grammar ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.28. Adopt `dev-standards-0.0.21.md`
  to `dev-standards-0.0.27.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards q-core patch`.

## What changed

- **RULE-STD-ARCH-104:** one noun per thing. Every callable, event, key scope and hook names its
  thing by its collection's singular, or by a noun from the app data package's declared-noun list
  (each entry names the collections the thing lives in or reads); never an alias or a category.
- **RULE-STD-BACKEND-305, rewritten:** `[admin]` + `create` | `update` | `delete` | `get` + thing +
  action. The verb is the effect on the thing named; an answer that removes its thing is a
  `delete`; no app adds verbs (`submit` → `create…Submission`, `seed` → `update…Seed`); `admin`
  starts exactly the admin-only callables; core `run` + name without `admin`, file named for the
  callable, declaration `use` + name + `Callable`, mutation hook `use` + name.
- **RULE-STD-BACKEND-202:** an audit event type is exactly `thing.pastTenseAction`, one name per
  happening, the same as its domain event's.
- **RULE-STD-FRONTEND-102 / 103 / 105:** key scopes from a collection constant or declared noun;
  domain events named as their audit event; the declared-hook and mutation-hook names above.
- **Codebase-hygiene step 13** is now "One naming grammar" and audits all of it; the crosswalk
  points the owning rules at it.

## What the app must change

- Install.
- The renames are their own item: `docs/work/waiting-to-be-implemented/one-naming-grammar.md`,
  which holds everything ttt-prod's build needs (ttt-core's declared-noun list, `getOpsStatus`'s
  noun, the `manage*` splits, report-core's `submitReport` contract). Until it is built, ttt-prod's
  names break the new rule text; nothing enforces it by guard yet.
- Delete the verb lines from the TTT additions to RULE-STD-BACKEND-305 when the item is built (the
  item says which stay).

**Done when:** the lockfiles name `@ttt-productions/dev-standards` 0.0.28 or later and the
naming-grammar item is in ttt-prod's `docs/work/`.
