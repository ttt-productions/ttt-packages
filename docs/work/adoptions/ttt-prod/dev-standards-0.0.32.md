# Adopt @ttt-productions/dev-standards 0.0.32

**What:** RULE-STD-FRONTEND-008 names its guard and says which layout classes compose with a ui-core part.
**Severity:** low
**Came from:** the Q-Sports UI-area ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.32.
- **Release:** `./scripts/release-multiple.sh dev-standards theme-core ui-core repo-guards patch`.
- **What changed:** RULE-STD-FRONTEND-008: the repo-guards `partRestyling` guard enforces the ui-core
  half, with a reviewed exception an entry in the app's guard config; theme-core's spacing classes
  compose with every part, its centering, clamp and truncation classes are for plain elements.
  `playbooks/crosswalk.md` names `partRestyling` on RULE-STD-FRONTEND-008.
- **What the app must change:** the install (root and `functions`); ttt-prod's own
  RULE-STD-FRONTEND-008 addition, if it names enforcing guards, adds `partRestyling`.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.32 or later.
