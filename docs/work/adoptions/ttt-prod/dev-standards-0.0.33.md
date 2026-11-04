# Adopt @ttt-productions/dev-standards 0.0.33

**What:** RULE-STD-FRONTEND-006 says plainly that its "…" menu clause binds member-facing screens only; admin pages are exempt.
**Severity:** low
**Came from:** the Q-Sports code-fixes ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.33.
- **Release:** `./scripts/release-multiple.sh dev-standards q-core patch`.
- **What changed:** `rules/frontend/core-rules.md` § RULE-STD-FRONTEND-006: every destructive action
  on an item lives in the one "…" menu on a member-facing screen; on a page of the admin area it may
  sit inline on its row, still behind its confirmation dialog, with red only on that dialog's
  confirm. The icon-swap and red clauses bind admin pages as written. The codebase-hygiene
  playbook's step 68 checks it that way.
- **What the app must change:** Install. A review of ttt-prod's admin pages reads the rule this way
  from then on.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.33 or later.
