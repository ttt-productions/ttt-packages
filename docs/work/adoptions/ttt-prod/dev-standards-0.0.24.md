# Adopt @ttt-productions/dev-standards 0.0.24

**What:** RULE-STD-BACKEND-004 says an admin uses admin power only through a control that is plainly an admin action.
**Severity:** low
**Came from:** the Q-Sports stored-schemas finish and rulebook ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.24. Adopt `dev-standards-0.0.21.md`
  to `dev-standards-0.0.23.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:** RULE-STD-BACKEND-004 (`rules/backend/core-rules.md`) states its purpose: a person
  who holds admin authority uses it only by choosing an admin action — a control that is plainly an
  admin action and calls the admin callable — so they always know when they act as an admin; a
  control meant for a resource's members never carries out admin power for an admin who happens to
  use it. Its Why adds the failure (an admin who is also a member would not know they had acted as an
  admin, and the audit would record an authority they never chose), and its Prohibits adds "a member
  control that succeeds for an admin only because of the admin role".
- **What the app must change:** Install. ttt-prod already builds this way — a member door on the
  page and its admin twin only in the admin actions (`closeCommission` / `adminCloseCommission`
  over `runCloseCommission`; `src/components/admin-tools/admin-action-registry.tsx`). Check that no
  member control in ttt-prod succeeds for an admin only because of the admin role; any that does is
  a ttt-prod item.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.24 or later, and the check
  above found nothing or filed its items.
