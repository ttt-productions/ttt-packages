# Adopt @ttt-productions/dev-standards 0.0.29

**What:** RULE-STD-FRONTEND-105 and the package-boundaries playbook stop naming a resumable action.
**Severity:** low
**Came from:** the Q-Sports stats-area ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.29.
- **Release:** `./scripts/release-multiple.sh q-core query-core repo-guards dev-standards patch`.
- **What changed:** RULE-STD-FRONTEND-105 lists the callable factory kinds as an action, a reader,
  or an invoker; package-boundaries playbook step 5 matches.
- **What the app must change:** only the install; nothing in ttt-prod names the resumable kind
  outside its guard config (`repo-guards-0.1.45.md`).
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.29 or later.
