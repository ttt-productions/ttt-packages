# Adopt @ttt-productions/dev-standards 0.0.9

**What:** RULE-STD-QUALITY-006 names a cast over a value another cast reshaped as a switched-off type.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (sixth package release)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.9.
- **Release:** `./scripts/release-multiple.sh dev-standards monitoring-core repo-guards patch`.
- **What changed:** `rules/quality/core-rules.md` § RULE-STD-QUALITY-006 bans `'x' as string as T` and `{ type: 'x' as string } as T` alongside `as never` and `as unknown as`. repo-guards 0.1.25's `blanketCasts` enforces it.
- **What the app must change:** Install. The code work is the repo-guards 0.1.25 adoption.
- **Done when:** The lockfiles name 0.0.9 or later.
