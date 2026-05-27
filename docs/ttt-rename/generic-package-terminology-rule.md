# Generic-package terminology rule

> Extracted from `ttt-prod/docs/playbooks/CODEBASE_HYGIENE_PLAYBOOK.md` step 34. This is the authoritative rule that prevents TTT-specific vocabulary from leaking into generic ttt-packages packages during the Phase 3.75 rename run. The agent running the rename MUST apply this rule alongside the convention doc — without it, the mechanical rename pollutes the tier-0 foundation.

## The rule

**Generic packages get generic comments and examples.** No TTT-specific terminology in `packages/*/src/` or `packages/*/__tests__/` of `ttt-packages`, with one exception: `packages/ttt-core/` is TTT-specific by design and IS allowed to use TTT vocabulary.

When a generic package's behavior is app-specific, the consumer (ttt-prod) configures that behavior via parameters, props, or generic config — the package itself does NOT hard-code TTT terms in:

- Comments and JSDoc
- Test fixtures, test data, mock values
- String defaults, example values, sample IDs
- Variable names in tests (when the variable is a sample/fixture, not a real package contract)

## How this rule interacts with the Phase 3.75 rename

The Phase 3.75 rename converts old TTT identifiers (`project`, `streetz`, `donation`, etc.) to new compound forms (`workProject`, `squareStreetz`, `pledgePayment`, etc.). **For generic packages, this conversion is wrong.** A generic test fixture using `'streetz'` should not become `'squareStreetz'` — it should become a neutral generic value with no TTT vocabulary at all.

### Decision tree per hit (apply during the rename run)

For every old-TTT-term hit in `packages/*/src/` or `packages/*/__tests__/`:

1. Is the file in `packages/ttt-core/`?
   - **Yes** → apply the convention doc rename normally.
   - **No** → continue.

2. Is the hit part of the package's exported API contract — a type field name, a public function parameter, a real production code path that ttt-prod depends on?
   - **Yes** → the package was already leaking TTT vocabulary into its API. Flag in the run report under "API-contract leakage discovered during rename" — do NOT apply either the TTT rename or the generic-fixture rule. Stop and report. The user will decide.
   - **No** → this is a comment / JSDoc / test fixture / sample value. Continue to step 3.

3. Replace the TTT term with a neutral generic value. Do NOT apply the convention doc compound.

## Neutral-replacement guidance for hits actually present in the repo

These are the concrete patterns the Phase 3.75 rename run will encounter in `ttt-packages` (verified against the pre-rename zip). Each one is a generic-package hit that must be neutralized, NOT compound-renamed.

| Package | Old TTT vocabulary | Wrong (mechanical rename) | Right (neutral replacement) |
|---|---|---|---|
| `query-core/src/keys.ts` | `'projects'` query-key scope | `'workProjects'` | `'entities'` — query-key factory is generic infrastructure |
| `query-core/src/react/firestore/use-firestore-doc.ts` | `['project', projectId]` in JSDoc example | `['workProject', workProjectId]` | `['entity', entityId]` — JSDoc example for a generic hook |
| `query-core/__tests__/cache-helpers.test.ts` | `['projects', 'list']`, `'pj-1'` IDs | `['workProjects', 'list']` | `['entities', 'list']`, `'e-1'` IDs |
| `chat-core/__tests__/mention-parser.test.ts` | `@[project:p1|My Tale]` | `@[workProject:p1|My Tale]` | `@[entity:e1|Sample Entity]` |
| `chat-core/__tests__/MessageText.test.tsx` | `@[project:p|P]` | `@[workProject:p|P]` | `@[entity:e|E]` |
| `chat-core/src/mentions/types.ts` JSDoc | `"user" or "project"` example | `"user" or "workProject"` | `"user" or "entity"` |
| `chat-core/src/types.ts` JSDoc | `project membership` example | `workProject membership` | `entity membership` |
| `upload-ui/__tests__/in-flight-uploads-provider.test.tsx` | `fileOrigin: 'streetz'`, `surface: '/streetz'` | `fileOrigin: 'squareStreetz'`, `surface: '/square-streetz'` | `fileOrigin: 'sample-origin'`, `surface: '/uploads-demo'` |
| `upload-ui/__tests__/use-upload-processing.test.tsx` | `fileOrigin: 'streetz'` | `fileOrigin: 'squareStreetz'` | `fileOrigin: 'sample-origin'` |
| `upload-ui/__tests__/upload-activity-tray.test.tsx` | `fileOrigin: 'streetz'` | `fileOrigin: 'squareStreetz'` | `fileOrigin: 'sample-origin'` |
| `upload-ui/src/react/upload-activity-tray.tsx` JSDoc | `'job-reply' -> 'Job application'` | `'commissionListing-reply' -> 'Commission application'` | `'support-ticket' -> 'Support reply'` (or any neutral example) |
| `upload-ui/src/react/use-clear-upload-activity.ts` comment | `"a callable in ttt-prod"` | (n/a — not a TTT vocab term) | leave as-is; "ttt-prod" is a repo name, not domain vocab |

## What is NOT generic-package leakage and stays

- `packages/upload-core/src/queue/upload-queue.ts` has `Job` / `job` as a generic queue-element type. This is a **generic background-job concept**, not a TTT Commission. It stays. (Hygiene playbook step 34's word list does NOT include "Job" for this reason.)
- The string `ttt-dev-cfb70` (Firebase project ID) and `ttt-prod` (repo name reference) appear in comments and test fixtures. These are repo/project identifiers, not domain vocabulary. They stay.
- `@ttt-productions/*` package import paths stay — they are package names.
- Variable names like `work` (as in "work to do"), `square` (geometry), `role` (auth role) stay — false positives per the convention doc.

## Verification

After the rename run, the grep from step 34 of the hygiene playbook must return zero hits:

```bash
grep -rniE "\b(TTT|ttt-prod|ttt-master-app|Streetz|Tales|Tunes|Television|Artisan|Realm|Trades|Pledge|Bouquet|Audition|Commission|Universe|Shareholders|Greenhouse)\b" packages/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.css' | grep -v "@ttt-productions/" | grep -v "packages/ttt-core/" | grep -v "ttt-dev-cfb70" | grep -v "ttt-prod"
```

Any surviving hit is either leakage that the agent missed (apply the generic replacement and log the fix) or a justified case that the agent should call out in the run report.
