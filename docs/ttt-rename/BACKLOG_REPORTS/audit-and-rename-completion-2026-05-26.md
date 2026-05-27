# Phase 3.75 ttt-packages audit + rename completion — findings

## 1. Needs-refactor (future slice prompts)

- Package: `query-core`
  - Symbol: exported `keys` const in `packages/query-core/src/keys.ts`
  - Why not trivial-move: the single exported `keys` const mixes generic scopes (`user`, `follows`, `entities`, `messages`, `admin`, `chat`, `notifications`, `mentions`, `custom`, etc.) with TTT-vocabulary scopes (`skills`, `library`, `opportunities`, `jobs`, `donations`, plus arguably `futurePlans`, `rulesAndAgreements`, `violations`, `feedback`). Moving the whole file to ttt-core would strip query-core of its legitimate generic scopes (and break the internal `keys.custom(...)` call in `query-core/src/react/search/use-firestore-search.ts`). Splitting the const into a generic core + a TTT extension is an API-shape change, not a strict location-only move.
  - Suggested approach: keep a generic key-builder primitive in query-core (`createKeyScope` already exists). Remove TTT-vocabulary scopes from `keys` in query-core. Have ttt-core define `tttKeys` (or similar) by composing `createKeyScope('thresholdLibrary')`, `createKeyScope('hallLibrary')`, `createKeyScope('auditionBoard')`, `createKeyScope('commissionListings')`, `createKeyScope('pledgePayments')`, `createKeyScope('craftSkills')`, etc. ttt-prod updates its imports to use the ttt-core scopes for TTT-specific keys and the query-core `keys` for generic ones.

- Package: `ui-core`
  - Symbol: `professions` variant on the exported `Badge` component (`packages/ui-core/src/react/components/badge.tsx`)
  - Why not trivial-move: the `professions` variant is one entry inside a `cva` variants config alongside generic variants (`default`, `secondary`, `destructive`, `outline`, `status`). A file move is not possible at the variant level; cva does not support extension from outside the call site, so the TTT-flavored styling cannot be lifted into a separate file without restructuring the component.
  - Suggested approach: drop the `professions` variant from the generic Badge. In ttt-prod (or a TTT-themed UI extension package), define a small wrapper around the generic Badge that supplies the same className combination via `className` or a wrapper component (`<TradeProfessionBadge>...</TradeProfessionBadge>`) — generic Badge stays generic, TTT styling lives where TTT vocabulary already lives.

## 2. Judgment calls (review me)

- File: `packages/auth-core/src/server/assertAuth.test.ts`
  - Decision: left the test variable `activeUserDoc` and the user `status: "active" | "banned" | "disabled"` enum alone.
  - Why: in auth-core "active" is the generic auth meaning ("signed-in, not banned"), not the TTT Work-membership `activeUser` concept. The status enum is auth terminology, parallel to `banned`/`disabled`.
  - Question: do you want this fixture renamed anyway to remove any whiff of the old TTT `activeUser` vocabulary (e.g. `signedInUserDoc`), even though the meaning is generic here?

- File: `packages/chat-core/__tests__/mention-parser.test.ts`, `packages/chat-core/__tests__/MessageText.test.tsx`
  - Decision: neutralized the displayText `'My Tale'` / `'My Cool Tale 2025!'` / `'P'` to `'Sample Entity'` / `'Sample Entity 2025!'` / `'E'`, and the id `'p1'` / `'p'` to `'e1'` / `'e'`, matching the generic-package-rule table.
  - Why: the kind was already neutralized to `entity` but the displayText was leaking TTT vocabulary (`Tale`); the rule's neutral-replacement table prescribes `Sample Entity`. Tales is on the convention doc's "not renamed" list, so the rename run would otherwise leave it alone — but it has no business appearing in a generic-package fixture.
  - Question: confirm `Sample Entity` is the desired generic placeholder. If you prefer `Sample Thread`, `Sample Channel`, or something else, swap it once and `replace_all` will catch it.

- File: `packages/notification-core/src/types.ts`
  - Decision: neutralized JSDoc examples `'project_invite'` → `'entity_invite'`, `'report_projectXYZ'` → `'report_entityXYZ'`, `{ projectId, reason }` → `{ entityId, reason }`.
  - Why: these are JSDoc examples for generic configuration types (`NotificationDoc`, dedup key, metadata). The rule's table covers `chat-core/src/types.ts` with `entity membership` — applied the same neutral vocabulary consistently.
  - Question: confirm `entity` is the right generic placeholder for notification examples, or do you want it to read more like a notification-system fixture (`'comment_reply'`, `'follow_event'`, etc.)?

- File: `packages/query-core/src/keys.ts`, `packages/query-core/__tests__/keys.test.ts`
  - Decision: left the JSDoc reference `keys.opportunities.custom('list', filter, sortBy)` and the `keys.opportunities` test invocation alone.
  - Why: those reference the API-contract leakage flagged in section 1. The decision tree in `generic-package-terminology-rule.md` says to flag-and-stop when the hit is part of the exported API contract. Touching just the JSDoc / test would create a mismatch between docs and the still-leaking surface.
  - Question: when the keys.ts refactor happens, the JSDoc and the test's scopes array (line 47) will need to update alongside. Flagging it here so the future slice prompt sees it.

- File: `packages/report-core/__tests__/useCheckoutNextImportantTask.test.ts`
  - Decision: neutralized the mock fixture `type: 'libraryReview'` → `type: 'sample-review'`.
  - Why: report-core is a generic package and the test only needs *a* string for the task type — `'libraryReview'` was a leaking TTT-vocabulary value. Chose `'sample-review'` as a neutral placeholder that still reads as a fixture.
  - Question: confirm `sample-review` is acceptable, or prefer `mock-task-type` / `'queue-a'` / similar.

## 3. API-contract leakage status

- `keys.library` / `keys.opportunities` / `keys.jobs` / `keys.donations` / `keys.skills` family in `packages/query-core/src/keys.ts`: still present. Not moved in Job 2 (not trivial — see section 1). Not renamed in Job 3 (the generic-package rule's decision tree flags API-contract leakage and stops). Captured in section 1 as a future slice prompt. The corresponding scopes array in `packages/query-core/__tests__/keys.test.ts` and the `keys.opportunities` JSDoc example in `keys.ts` will need to move with the refactor — see the judgment call above.

- `professions` variant on `Badge` in `packages/ui-core/src/react/components/badge.tsx`: still present. Not a separate-file symbol; cannot trivial-move. Captured in section 1.

## 4. Final verification

- npm run lint: PASS
- npm run typecheck: PASS
- npx tsc -b --noEmit: PASS
- npm run build: PASS
- npm run test: PASS (160 files, 1793 tests)
