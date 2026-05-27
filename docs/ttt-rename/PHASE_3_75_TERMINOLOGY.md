# Phase 3.75 — Terminology rename

> Pre-launch work file. Full terminology rename across `ttt-packages`, `ttt-prod`, Firestore rules and indexes, storage rules, Stripe surface, E2E tests, and root `CLAUDE.md`. Deleted post-launch.

Vocabulary itself is NOT in this doc. The single source of truth for every renamed term, every compound code identifier, every edge case, and every worked example is `docs/design/terminology-naming-convention.md`. This doc is the execution plan only.

---

## Prerequisites (DONE — both shipped)

Two structural refactors landed before the rename runs can execute. These were code-shape changes, not terminology changes. Both are complete.

### Prereq 1 — Flatten the library Firestore structure — DONE

The old 3-level nest:

```
contentLibrary/
├── pendingItems/
│   └── libraryItems/
│       └── {libraryId}
└── publishedItems/
    └── libraryItems/
        └── {libraryId}
```

Collapsed to two flat top-level collections with state implicit in the collection name:

```
thresholdItems/{itemId}    ← pending submissions awaiting admin review
hallItems/{itemId}         ← approved, published content
```

State transition (admin approves) is a delete-from-`thresholdItems` + write-to-`hallItems` Firestore batch.

Shipped:
- `firestore.rules` uses the two new top-level paths
- `firestore.indexes.json` updated
- `storage.rules` updated for the new storage paths
- `runSubmitForLibraryReview` writes to `thresholdItems/`
- `runPublishApprovedLibraryItem` does delete-from-threshold + write-to-hall in one batch
- Read sites updated
- E2E tests updated

### Prereq 2 — Split `use-message-queries.tsx` — DONE

The old `src/hooks/use-message-queries.tsx` was split into:

- `src/hooks/use-admin-dispatch-queries.tsx` — admin/system message hooks
- `src/hooks/use-guild-invite-queries.tsx` — invite hooks

Hook identifier renames happen in the terminology rename run.

---

## Recently locked decisions

Pinned in the convention doc. Listed here as quick reference for the rename runs; the convention doc remains authoritative.

1. **`jobListings` → `commissionListings`** (not `commissionJobListings`). Compound rule is "two meaningful words, grep-safe, best pair wins."
2. **Sub-item renames:**
   - `tuneSongs` → `tuneTracks`, `TuneSong` → `TuneTrack`, `songId` → `trackId`
   - `tvShows` → `televisionEpisodes`, `TvShow` → `TelevisionEpisode`, `showId` → `episodeId`
3. **Owner → Steward standing:**
   - Stored Firestore value `'Owner'` becomes `'Steward'`
   - Code identifier `Owner` / `owner` (as a Standing value) becomes `StewardOwner` / `stewardOwner`
4. **Donation default:**
   - All existing `donation*` / `Donation*` code renames to `pledgePayment*` / `PledgePayment*`
   - `bouquetAppreciation*` does NOT appear in this rename pass
5. **Dotted action strings use the full compound for the noun:**
   - `workProject.stakeShares.manage` — correct
   - `workProject.stakes.manage` — wrong
6. **Subcollection rename list (the locked set):**
   - `profileSkills` → `profileCraftSkills`
   - `userDonations` → `userPledgePayments`
   - `streetzLikes` → `squareStreetzLikes`
   - `taggedSkills` → `taggedCraftSkills`
   - `opportunityVotes` → `auditionVotes`
   - `chatChannels` → `guildChatChannels`
   - `channelMessages` → `guildChatMessages`
   - `activeUsers` (on a Work) → `guildmateUsers`
   - `tuneSongs` (on a Tune Work) → `tuneTracks`
   - `tvShows` (on a Television Work) → `televisionEpisodes`

---

## Execution methodology

Two autonomous-agent runs (Codex Sonnet 1M or Claude Code Sonnet 1M):

1. **ttt-packages run** — renames inside the monorepo. Scope unit: per-package boundary.
2. **ttt-prod run** — renames inside the app repo, after ttt-packages is published and consumed. Scope unit: whole-app boundary.

Both runs follow the same four-step loop.

### Step 1 — Discover

Grep the in-scope tree for every old-term identifier from the convention doc mapping table. Build the working list dynamically by re-grepping as edits ship — do NOT accept a static file manifest from the prompt. The agent owns discovery.

Grep multiple variants per term to catch camelCase compounds, PascalCase compounds, and plurals. A word-boundary grep against `\bproject\b` does NOT match `projectId` (no word-character/non-word-character boundary inside camelCase). Run multiple greps per term: `Project`, `projects`, `Projects`, `allProjects`, `projectId`, `projectUid`, `ProjectFile`, `useProject`, etc.

### Step 2 — Per-file loop (no mid-stream verification)

For each file with hits:

- Read the file
- Classify every old-term occurrence against the convention doc edge cases (code identifier / UI string / comment / Firestore string / audit event / third-party / false positive)
- Apply the rename per classification
- Save the file
- Append one line to the run report: `file path | terms touched | classifications applied | done`
- Move on. **Do NOT run typecheck, lint, build, or tests between files.**

### Step 3 — Scope-boundary verification

For ttt-packages (per-package, in tier order from `ttt-packages/CLAUDE.md`: Tier 0 first, then Tier 1, then `ttt-core`, then `upload-ui`, then `chat-core`):

- `npm run typecheck --workspace=packages/<pkg>`
- `npm run build --workspace=packages/<pkg>`
- `npx vitest run --project <pkg>` (only if the package has a vitest project)

Each command on its own line. No `&&` chains. If failures, fix as a sub-loop and log fixes to the run report.

For ttt-prod (single boundary at end of run):

- `npm run lint`
- `npm run typecheck`
- `npx vitest run`
- `npm run lint:functions`
- `npm run typecheck:functions`
- `npm run build --prefix functions`
- `npx vitest run --root functions`

### Step 4 — Final discovery sweep

After all boundaries pass, re-grep the entire in-scope tree for every old-term identifier. For each remaining hit, classify and decide: legitimately exempted (third-party, false positive — explain why) or missed (apply the rename now). Log all remaining hits and decisions to the run report. The run is complete only when discovery returns zero unjustified hits.

### Why per-file verification is wrong

Renaming is a graph operation. Renaming a type in one file breaks every importing file until they also rename. If the agent verifies after each file, it sees cascade failures that aren't real problems — they resolve themselves once the next batch is renamed. Mid-stream verification produces churn, wasted time, and sometimes bad compatibility shims invented to "fix" temporary errors. Boundary verification catches real problems without churn.

### Audit log discipline

The run report is the only record of what the agent did. Log every file *before* moving on, not in batches. Past autonomous runs have failed by skipping the log step and losing track of which files were touched.

### Post-run review

Sequence after each autonomous run:

1. Agent completes its run, paste-back, run report saved.
2. User reviews paste-back; user runs heavier verification locally (with emulators started) — `test:rules`, `test:e2e`, manual smoke testing. These do NOT appear in any autonomous-agent prompt.
3. User uploads the post-rename repo zip to both Claude and ChatGPT for independent reviews. Reviewers look for: stale comments, stale docs, stale filenames, missed uses, classification errors. Two independent eyes on the same code.
4. Findings from independent review get fixed in surgical follow-up prompts.

---

## Scoping checklist — what the rename touches

Use `docs/design/terminology-naming-convention.md` as the source of truth for per-term names. This section is the checklist of WHERE to apply the renames.

- **Firestore collections and doc IDs** — top-level collections that hold domain data: `creators/`, `streetzFeed/`, `profileSkills/`, `skillsByTag/`, `taggedSkills/`, `jobListings/`, `opportunityBoard/`, `allProjects/`, `storyUniverses/`, `chatChannels/`, `channelMessages/`, `pendingAdminMessages/`, etc. Also subcollections (`activeUsers/` on Works, `projectFiles/`, `applicants/`, etc.). Note: `contentLibrary/` was restructured to `thresholdItems/` / `hallItems/` in Prereq 1 (already shipped).
- **Firestore fields on existing docs** — anywhere `donation` / `donate` / `creator` / `skill` / `profession` / `category` / `library` / `libraryType` / `streetz` / `universe` / `project` / `shareholder` / `share` / `company` / `marquee` / `opportunityBoard` / `opportunityReply` / `applicant` / `application` / `projectInvite` / `projectOwner` / `ownerUid` / `creatorUid` / `ownedBy` / `activeUser` / `memberRole` / `channelMessage` / `adminMessage` / `systemMessage` / `song` / `show` appears as a field name.
- **Firestore rules** (`firestore.rules`) — every collection path segment that gets renamed.
- **Firestore indexes** (`firestore.indexes.json`).
- **Storage rules** (`storage.rules`) — every renamed-collection path (`projectFiles/{...}` → `workAssets/{...}`, etc.).
- **Stripe product/price names and descriptions** — anywhere `donation` appears in payment surface naming.
- **Stripe webhook event routing** — if event types are named after donations.
- **Cloud Functions names and internal logic** — every callable that names a renamed domain concept: `becomeCreator`, `manageStreetzPost`, `createJobListing`, `rejectJobApplicant`, `acceptJobApplicant`, `voteForOpportunityReply`, `createChatChannel`, `runSendChatMessage`, `updateProjectMemberRole`, `runSubmitForLibraryReview`, `runPublishApprovedLibraryItem`, etc.
- **TypeScript types** across the app and `ttt-packages` (`chat-core`, `report-core`, `firebase-helpers`, `ttt-core`, others). Renamed per the compound mapping in the convention doc.
- **React components, hooks, pages** (`src/`) — every component, hook, file, and folder named after a renamed concept: `useCreator*` → `useArtisanCreator*`, `useLibrary*` → `useHallLibrary*` / `useThresholdLibrary*`, `useStreetz*` → `useSquareStreetz*`, `useDonate*` → `usePledgePayment*`, `useJobListing*` → `useCommissionListing*`, `useProject*` → `useWorkProject*`, `useShareholder*` → `useGuildmateShareholder*`, `useOpportunity*` / `useMarquee*` → `useAudition*`, `useProjectFile*` → `useWorkAsset*`, `useProjectChat*` → `useGuildChat*`, `useApplicant*` → `useCommissionProposal*`, `useProjectInvite*` → `useGuildInvite*`, `useMessage*` (admin side, post-Prereq-2 split) → `useAdminDispatch*`. Folder/file renames: `src/app/projects/` → `src/app/work-projects/`, `src/app/streetz/` → `src/app/square-streetz/`, `src/app/board/` → `src/app/commission-board/`, etc.
- **UI copy everywhere** — buttons, tooltips, dialogs, error messages, headings. Uses the short new term (Artisan, Trade, Realm, Work, Guild, Guildmate, Steward, Founding Artisan, Standing, Threshold, Hall, Wing, Square, Laurels, Pantheon, Audition, Entry, Commission, Proposal, Shortlist, Invite, Chat, Messages, Genre, Asset, Craft, Stake, Pledge, Bouquet).
- **Transactional email templates**.
- **Admin task queue labels**.
- **Admin browsable view labels** (`Library Review` → `Threshold Review`, `Job Listings` → `Commissions`, etc.).
- **E2E test files, selectors, text matchers** — every spec under `e2e/` that names a renamed concept.
- **`CLAUDE.md`** at the root of both repos (NOT under `docs/`).
- **Public-facing copy** (landing page, about, FAQ).
- **All `docs/` references** — performed by ChatGPT in a post-rename cleanup pass, NOT as part of the autonomous rename runs.

**Post-rename Firestore collection structure (target):**
- `thresholdItems/{itemId}` — pending sub-item submissions awaiting admin review (already shipped in Prereq 1)
- `hallItems/{itemId}` — approved, publicly-visible content (already shipped in Prereq 1)
- `allWorkProjects/{workProjectId}` — Works
- `workRealms/{workRealmId}` — Realms
- `commissionListings/{commissionListingId}` — Commissions
- `commissionProposals/{commissionProposalId}` — Proposals against Commissions
- `auditionBoard/{auditionId}` — Auditions
- `auditionEntries/{auditionEntryId}` — Entries to Auditions
- `guildInvites/{guildInviteId}` — Invites to Guilds
- `guildChatChannels/{guildChatChannelId}` — Guild Chat channels (per Work)
- `pendingAdminDispatches/{adminDispatchId}` — admin support / system message threads

---

## Todos

- [ ] Execute ttt-packages rename run (Codex / Claude Code, autonomous)
- [ ] Publish renamed packages and install in ttt-prod
- [ ] Execute ttt-prod rename run (Codex / Claude Code, autonomous)
- [ ] User runs `test:rules` + `test:e2e` + manual smoke locally after each run (emulators started by user)
- [ ] Independent post-run reviews by Claude and ChatGPT (stale comments, stale docs, stale filenames, missed uses, classification errors)
- [ ] Post-rename `docs/` cleanup pass (ChatGPT, separate workstream)
- [ ] Update root `CLAUDE.md` in both repos with the new vocabulary