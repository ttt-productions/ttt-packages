# Cleanup Progress — ttt-packages

Run started: 2026-06-03   Last updated: 2026-06-03

This ledger tracks the autonomous, unattended cleanup pass for the shared
monorepo (comments + module-internal dead code only; never delete a package
export). No git ops, no version bumps, no publishing. Gate = `npm run lint` +
`npm run typecheck` + `npx tsc -b --noEmit` + per-package build + `npm run test`.

## RESUME POINTER

packages/*/src comment cleanup COMPLETE + gate-verified. Next (if a later session
continues): ttt-packages `docs/` accuracy + consolidation pass (NOT done this run —
ran out of scope after the ttt-prod docs work; lower priority than the code passes).

## AREAS

- [done] packages/*/src — conservative comment-only cleanup across ALL 22 packages
  via 5 tightly-scoped sonnet subagents + audit + zip-diff verification. Only ~30
  comment lines removed total (packages were already clean — only 3 path banners
  existed, all in auth-core/server, banner-line-only removed with design prose kept).
  NO export removed. NO module-internal symbol removed directly (all dead-code
  candidates reported, none met the "provably dead + typecheck-confirmed" bar safely
  — see followup). JSDoc/TSDoc on all exports preserved. Gate PASS: lint, typecheck,
  `tsc -b --noEmit` (exit 0), `npm run test` (168 files / 1927 tests). zip-diff vs
  pre-run `ttt-packages-full-no-dist.zip` confirms NO multi-line/design-block losses
  (max shrink 5 lines, all itemized single-line removals).
- [pending] docs/ (design, packages, playbooks) — NOT done this run.

## PACKAGES TO PUBLISH

All edits this run were comment-only (no behavior change, no error-fix to package
code), so NOTHING strictly needs publishing for correctness. Packages with comment
edits — **cosmetic only, publish whenever convenient** (no DEFERRED ttt-prod change
depends on any of them):

- @ttt-productions/ttt-core — cosmetic only (5 redundant field-label comments)
- @ttt-productions/ui-core — cosmetic only
- @ttt-productions/report-core — cosmetic only
- @ttt-productions/media-processing-core — cosmetic only (1 comment)
- @ttt-productions/query-core — cosmetic only (none/near-none)
- @ttt-productions/firebase-helpers — cosmetic only
- @ttt-productions/file-input — cosmetic only (none/near-none)
- @ttt-productions/auth-core — cosmetic only (3 path-banner lines)
- @ttt-productions/mobile-core — cosmetic only (none/near-none)
- @ttt-productions/upload-core — cosmetic only
- @ttt-productions/chat-react — cosmetic only (JSX section labels)
- @ttt-productions/media-viewer — cosmetic only
- (notification-core, monitoring-core, moderation-core, theme-core, chat-core,
  media-schemas, rate-limit-core, audit-core, chat-schemas, upload-ui — little or
  no edits; cosmetic only if any.)

**No "publish needed" (behavior/export) items.**

## DEFERRED TTT-PROD CHANGES (post-publish follow-ups)

(none yet)

## SUGGESTIONS BACKLOG

See `docs/code_changes_needed/cleanup-suggestions-followup.md` — file splits
(including internal ones, noting public-export impact), package-export
dead-code candidates, risky deletions, and doc-structure proposals go there.

## ERRORS FOUND (reported, NOT fixed unless trivial)

- PRE-EXISTING (not caused by this run — comment-only edits cannot cause these, and
  no test file was touched): `npx tsc -b --noEmit` surfaces type errors in two test
  files — `packages/media-processing-core/__tests__/result.test.ts` (accesses
  `.error` on a success-typed result) and `packages/ttt-core/__tests__/media-specs-per-origin.test.ts`
  (indexes a spec map with a `'file'` key that the type doesn't include). `tsc -b`
  still exits 0 and `npm run test` (vitest) passes all 1927 tests, so these are
  non-blocking, but the test types have drifted from the source types. Left for you.

## DECISIONS NEEDED FROM USER

(none yet)
