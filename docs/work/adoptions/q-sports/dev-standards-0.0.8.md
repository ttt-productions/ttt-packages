# Adopt @ttt-productions/dev-standards 0.0.8

**What:** Both ESLint presets fail a promise returned from inside a `try` without `await`; a problem found outside the work is asked as an open question.
**Severity:** high
**Came from:** the ttt-prod shared-standards Phase 3 repair session (fifth package release)

- **Package and version:** `@ttt-productions/dev-standards` 0.0.8.
- **Release:** `./scripts/release-multiple.sh auth-core dev-standards monitoring-core repo-guards ttt-core patch`.
- **What changed:**
  - `createAppEslintConfig` and `createFunctionsEslintConfig` turn on `@typescript-eslint/return-await` with `in-try-catch` on every TypeScript file. A promise returned from inside a `try` (or a `catch` followed by `finally`) must be awaited, or its rejection skips the `catch` — a callable's `return db.runTransaction(...)` inside the try escapes its error exit with no log and no capture. Outside a `try`, a needless `return await` is the rule's other finding.
  - `development-preferences.md`: a problem found outside the item being worked is an open question for DJ, fully investigated and asked like any other question.
- **What the app must change:** Install. Run lint on the app and on Functions: each "returning an awaited promise is required in this context" finding is a real bug — add the `await` and add a regression test where the skipped catch did work (a log, a capture, an error mapping). The needless-`await` findings are fixed by `eslint --fix`.
- **Done when:** The lockfiles name 0.0.8 or later and both lints are clean.
