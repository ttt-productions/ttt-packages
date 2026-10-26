# Adopt @ttt-productions/dev-standards 0.0.13

**What:** RULE-STD-QUALITY-012 now says where a test's read state comes from, and names repo-guards' `handBuiltReads` as its guard.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.13.
- **Release:** `./scripts/release-multiple.sh dev-standards query-core repo-guards patch`.
- **What changed:**
  - `rules/quality/core-rules.md` § RULE-STD-QUALITY-012 adds one sentence: a read's state comes from
    the read builders or the real hook, never from a hand-written retry state, a result read off an
    observer the test built itself, or a hand-seeded query cache, enforced by `handBuiltReads`.
  - `playbooks/crosswalk.md` names `handBuiltReads` as RULE-STD-QUALITY-012's guard.
- **What the app must change:** the install, at the root and in every folder that declares
  dev-standards. The guard itself arrives with repo-guards 0.1.30 (its own adoption file).
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.13 or later.
