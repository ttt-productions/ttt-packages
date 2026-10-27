# Adopt @ttt-productions/dev-standards 0.0.14

**What:** The testing-coverage playbook's test-double step and the crosswalk now name the `typedMocks` builder check.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.14.
- **Release:** `./scripts/release-multiple.sh ttt-core repo-guards dev-standards patch`.
- **What changed:**
  - `playbooks/testing-coverage-playbook.md` step 12 adds a check (d): every export the tests replace with a stand-in that has shared builders is listed under the guard config's `typedMocks` `builtOverrides`; the findings add an export with shared builders whose stand-ins the config does not hold to them.
  - `playbooks/crosswalk.md` maps `RULE-STD-QUALITY-012` to `typedMocks` beside `handBuiltReads`.
  - No rule text changed.
- **What the app must change:** only the install. An app addition step that restates testing-coverage step 12 adds check (d).
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.14 or later.
