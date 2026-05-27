# TTT Terminology Naming Convention

The full per-term mapping table and edge-case rules for the TTT domain term naming convention. The convention itself (rule statement, why, what it forbids) lives in `docs/design/architectural-preferences.md` Rule 6. This doc is the per-term reference.

## The rule (one paragraph)

Every TTT domain concept gets a permanent two-word compound code identifier. The default shape is `<NewTerm><OldTerm>` (e.g. `ArtisanCreator`, where the old word in the suffix position is the grep anchor), but the compound is chosen for clarity and grep-safety rather than strict adherence to the new+old pattern: where a more descriptive pairing serves better (e.g. `WorkRealm` rather than `RealmUniverse`, `GuildmateUser` rather than `GuildmateActiveUser`), use the clearer pairing. The non-negotiables are: two words, both meaningful, at least one half grep-safe (uncommon enough that grepping it returns mostly real hits). Code identifiers (types, variables, functions, files, Firestore collections, React Query keys, audit event types, callable names, route paths, test IDs) use the compound form. UI-facing strings (button labels, page copy, tooltips, error messages shown to users, comments, JSDoc, docs/ content) use the short new term. The compound form is the permanent code-side identifier; the new word is the user-facing label.

## Mapping table

| UI label (short) | Code identifier (compound) | Old code identifier | Notes |
|---|---|---|---|
| Artisan | `ArtisanCreator` / `artisanCreator` | `Creator` / `creator` | The "creator" claim/role/concept. |
| Realm | `WorkRealm` / `workRealm` / `workRealms` | `Universe` / `universe` / `storyUniverses` | The self-contained world that holds Works bound by shared lore. Compound emphasizes that a Realm holds Works (not the rename artifact). |
| Work | `WorkProject` / `workProject` / `workProjects` | `Project` / `project` / `allProjects` | A Tale, Tune, or Television piece. Container for sub-items (Chapters, Tracks, Episodes). |
| Guild | `WorkGuild` / `workGuild` / `workGuilds` | (no prior code term — the Guild group concept) | The group of Guildmates bound to a Work who hold its Stakes. Code-side identifier for the group as an entity (member list, guild chat, guild subcollection). |
| Guildmate | `GuildmateUser` / `guildmateUser` / `guildmateUsers` / `guildmateUserIds` | `activeUser` / `activeUsers` / `ActiveUsersSection` | One person in a Guild. Used for Work-membership references everywhere the old code said "active user" or "project user." |
| Guildmate (stake-ownership capacity) | `GuildmateShareholder` / `guildmateShareholder` / `guildmateShareholders` | `Shareholder` / `shareholder` | A Guildmate specifically in their stake-holder capacity — payouts, stake transfers, ownership records. Most code uses `GuildmateUser`; reach for `GuildmateShareholder` only when the stake-ownership angle is the point. |
| Stake | `StakeShare` / `stakeShare` / `stakeShares` | `Share` / `share` (ownership unit) | An individual ownership unit of a Work (1,000 Stakes per Work). NOT to be confused with "share" as in social-share-button — that one stays unchanged because it is a verb, not a domain noun. |
| Threshold | `ThresholdLibrary` / `thresholdLibrary` | `Library` (pending state) | The pre-publication holding area for items awaiting admin review. |
| Hall | `HallLibrary` / `hallLibrary` | `Library` (published state) / `contentLibrary` | The published library where approved items live. |
| Wing | `HallWing` / `hallWing` / `HallWingType` | `libraryType` / `LibraryItemType` | The content-classification dimension of the Hall (Entertainment Wing, Educational Wing, News Wing). Values stay as `entertainment` / `educational` / `newsPolitical`. |
| Square | `SquareStreetz` / `squareStreetz` | `Streetz` / `streetz` / `streetzFeed` | The social feed / public gathering ground. |
| Laurels | `LaurelsGarden` / `laurelsGarden` | `Garden` / `garden` | Per-Work per-month recognition (monthly reset). Post-launch UI; data model leaves room now. |
| Pantheon | `PantheonGreenhouse` / `pantheonGreenhouse` | `Greenhouse` / `greenhouse` | The lifetime-recognition surface. Post-launch UI; data model leaves room now. |
| Audition | `AuditionBoard` / `auditionBoard` / `AuditionBoardPage` | `OpportunityBoard` / `opportunityBoard` / `Marquee` / `votePage` | The public submission-and-voting surface. The vote *verb* stays as "vote" — only the surface is renamed. |
| Audition type | `AuditionType` / `auditionType` (field) with values `platformAudition` / `workAudition` / `sponsoredAudition` | `systemInput` / `projectInput` / `sponsoredProject` | The three modes of an Audition: platform-run, work-run, sponsored. Values don't repeat `Type` — the enclosing field is already `auditionType`. |
| Entry | `AuditionEntry` / `auditionEntry` / `auditionEntries` / `submittedAuditionEntries` / `auditionEntryVote` | `opportunityReply` / `opportunityReplies` / `submittedReply` / `videoReply` / `replyVote` | The submission an Artisan makes to an Audition. |
| Commission | `CommissionListing` / `commissionListing` / `commissionListings` | `JobListing` / `jobListing` / `jobListings` / `job` / `jobs` | One Commission entry — the listing concept. Public posting where Works request specific contribution; Artisans submit Proposals. |
| Commissions (board surface) | `CommissionBoard` / `commissionBoard` / `CommissionBoardSection` | `jobBoard` / `JobBoardSection` / `JobBoardFilters` / `JobBoardTable` | The board/listing surface where Commissions are posted and browsed. |
| Proposal | `CommissionProposal` / `commissionProposal` / `commissionProposals` / `CommissionProposalsSection` | `application` / `applications` / `applicant` / `ApplicantsSection` | The submission an Artisan sends in response to a Commission. UI uses "Proposal" for the submission and "Artisan" for the person who submitted it. Action callables: `acceptCommissionProposal` / `declineCommissionProposal`. |
| Proposal (artisan reference) | `ProposalArtisan` / `proposalArtisan` | `applicant` / `applicants` | The Artisan who submitted a specific Proposal. Most callsites use the `artisanUid` on the Proposal doc directly; reach for `ProposalArtisan` only when "the Artisan who submitted this Proposal" is a distinct entity in code. |
| Shortlist | `ProposalShortlist` / `proposalShortlist` / `shortlistedProposalIds` | (existing feature, current terms TBD per code) | Saved Proposals on a Commission. |
| Standing | `GuildStanding` / `guildStanding` / `guildStandings` / `requiredGuildStandings` | `role` / `roles` / `memberRole` / `requiredRoles` / `projectMemberRole` | The in-Work permission level (Steward, admin, editor, viewer, etc.) — distinct from system-level admin roles. Compound says exactly where the Standing applies and avoids permanent collision with system / admin / auth roles. The stored standing value `'Owner'` becomes `'Steward'` (single word, user-facing); the code identifier `Owner` / `owner` (as a Standing value) becomes `StewardOwner` / `stewardOwner`. See edge case "Owner → Steward standing value." |
| Invite | `GuildInvite` / `guildInvite` / `guildInvites` / `guildInviteConversation` / `pendingGuildInvites` | `projectInvite` / `projectInviteConversation` / `pendingInvitations` | Private invitation from a Work's Steward to a specific Artisan to join its Guild. Distinct from Commissions (public listings with Proposals) and Auditions (public submissions with Entries). |
| Craft | `CraftSkill` / `craftSkill` / `craftSkills` / `profileCraftSkills` | `skill` / `skills` / `profileSkills` / `skillsSearchSection` | The user-uploaded media samples on an Artisan's profile — proof of their Trades. |
| Trade | `TradeProfession` / `tradeProfession` / `tradeProfessions` / `requiredTradeProfessions` | `profession` / `professions` / `requiredProfessions` | The job category — what kind of Artisan a Commission needs (Writer, Composer, Editor, etc.). |
| Genre | `WorkGenre` / `workGenre` / `workGenres` / `WORK_GENRES` / `TunesWorkGenresSection` / `useUpdateTuneWorkGenres` | `category` / `categories` / `PROJECT_SPECIFIC_CATEGORIES` / `TunesCategoriesSection` / `useUpdateTuneCategories` | The per-Work-type tagging system (e.g. Fantasy Tales, Jazz Tunes, Drama Television). |
| Asset | `WorkAsset` / `workAsset` / `workAssets` / `useUploadWorkAsset` / `processWorkAsset` / `WorkAssetsSection` / `MAX_WORK_ASSETS` | `ProjectFile` / `projectFile` / `projectFiles` / `useUploadProjectFile` / `processProjectFile` / `FilesSection` / `MAX_PROJECT_FILES` | Media files attached to a Work (promo images, behind-the-scenes, supplementary material). |
| Chat | `GuildChat` / `guildChat` / `guildChatChannel` / `guildChatMessage` / `createGuildChatChannel` / `useGuildChatQueries` | `chatChannel` / `channelMessage` / `createChatChannel` / `useProjectChatQueries` | The chat inside a Work for Guildmates to coordinate. |
| Messages | `AdminDispatch` / `adminDispatch` / `adminDispatches` / `pendingAdminDispatches` / `AdminDispatchTaskCard` / `useAdminDispatchQueries` | `adminMessage` / `systemMessage` / `pendingAdminMessages` / `SystemMessageTaskCard` / `useMessageQueries` | One term covers both human-admin replies and system-generated messages — both live in the same admin-dispatch flow. UI keeps the plain word "Messages." |
| Steward | `WorkSteward` / `workSteward` / `workStewards` / `workStewardUid` / `workStewardUids` | `projectOwner` / `ownerUid` / `ownedBy.uid` | The current owner/controller of a Work. Today equals the Founding Artisan (no transfer-of-ownership feature yet); the split exists so future ownership transfers leave the original-creator identity intact. |
| Founding Artisan | `FoundingArtisan` / `foundingArtisan` / `foundingArtisanUid` | `creatorUid` (where it means original creator) | The Artisan who originally created a Work. Set once at Work creation, never changes. Distinct from Steward (current owner) — today they're equal, but the split is locked in now for future ownership-transfer features. |
| Pledge | `PledgePayment` / `pledgePayment` | `Donation` / `donation` (payment side) | The monetary pledge — Stripe-backed. |
| Bouquet | `BouquetAppreciation` / `bouquetAppreciation` | `Donation` / `donation` (appreciation side) | The audience-to-Work appreciation gesture ($1.75 tossed at a Work). |
| Charter Member | `CharterMember` / `charterMember` | `CharterMember` / `charterMember` | Already compound. No change. Granted to users who pledge $15+. |
| Track | `TuneTrack` / `tuneTrack` / `tuneTracks` / `trackId` | `TuneSong` / `tuneSong` / `tuneSongs` / `songId` | The sub-unit of a Tune Work (one song, one instrumental, one podcast episode, one audiobook chapter). Replaces the old "Song" terminology because Tracks scale across music, instrumental work, podcasts, audiobooks, and spoken-word — all of which the platform supports. |
| Episode | `TelevisionEpisode` / `televisionEpisode` / `televisionEpisodes` / `episodeId` | `TvShow` / `tvShow` / `tvShows` / `showId` | The sub-unit of a Television Work (one episode, one film, one documentary segment, one video essay). Replaces the old "Show" terminology because Episodes covers serialized TV, films, documentaries, video essays, music videos, and web series. |

Terms that are NOT renamed and stay as-is:

- `Tale`, `Tune`, `Television` (the three content kinds) — already TTT-specific.
- `Chapter` — Tale sub-unit; already TTT-friendly and not colliding with prior code.
- `Follower`, `Follow`, `Like` — generic social verbs/nouns; no rename.
- `Vote` (the action verb) — universally understood; only the surface (Audition Board) is renamed.

## Edge cases

### Sub-types that map from the same old term (`ThresholdLibrary` vs `HallLibrary`)

`Library` splits into two distinct domain concepts based on item state. Identifiers lean into the state distinction:

- A pending item type is `ThresholdLibraryItem`. The threshold-side React Query key is `thresholdLibraryKeys`. The threshold-side callable is `submitForThresholdLibraryReview`.
- A published item type is `HallLibraryItem`. The hall-side React Query key is `hallLibraryKeys`. The hall-side callable is `publishApprovedHallLibraryItem`.
- **Firestore structure.** The two states live in two flat top-level collections: `thresholdItems/{itemId}` (pending submissions) and `hallItems/{itemId}` (approved content). State is implicit — the collection itself tells you the state — so there is no `status` field discriminator. State transition (admin approves) is a delete-from-`thresholdItems` + write-to-`hallItems` operation in a single Firestore batch.

When ambiguous, prefer the more specific compound (`ThresholdLibraryItem` over `LibraryItem`) at every call site. If a single function genuinely operates on both states, use `LibraryItem` and discriminate inside the function — but the function name still gets a state qualifier (`updateThresholdOrHallLibraryItem`).

### Owner → Steward standing value

The stored standing value `'Owner'` (a Firestore string in the `standing` field on Guildmate docs) becomes `'Steward'` (single word, user-facing). The code identifier `Owner` / `owner` — when used as a Standing value reference in TypeScript (a const, an enum-like union member, a discriminator) — becomes `StewardOwner` / `stewardOwner`. The compound preserves grep-safety because bare `Owner` / `owner` collides with too many unrelated concepts (object ownership in general code, Firestore Storage IAM, third-party libraries). UI-facing text uses "Steward" alone.

When the codebase has a permission-actions string that previously included `owner`, the new string uses the full compound: e.g. `guildStanding.stewardOwner.assign`, not `guildStanding.steward.assign`.

### Donation → PledgePayment / BouquetAppreciation split

The old `donation` / `Donation` concept fans out into two new domain concepts depending on the meaning at the call site:

- **Platform funding** (a user pledges money to TTT the company): `PledgePayment` / `pledgePayment`. This is the default reading of any `donation*` identifier, because the codebase's current `donation*` concept refers to platform funding.
- **Audience-to-Work appreciation** ($1.75 tossed at a Work): `BouquetAppreciation` / `bouquetAppreciation`. The Bouquet system is a separate domain concept that the data model leaves room for.

**Default rule:** any `donation*` / `Donation*` identifier refers to `PledgePayment` unless the call site is specifically about audience-to-Work appreciation.

### Plurals

Plurals follow English convention applied to the compound. The plural of `ArtisanCreator` is `ArtisanCreators`, not `Artisans`. Variable holding a list: `artisanCreators`, not `artisans`.

For UI strings, plurals follow English convention applied to the short term: "5 Artisans," not "5 Artisan Creators."

### Audit event types

Audit event type strings use the compound form with a dotted action suffix: `artisanCreator.granted`, `craftSkill.userCraftSkillDeleted`, `squareStreetz.streetzPostLiked`. The suffix uses camelCase action verbs and may itself contain the compound where relevant.

**The noun part of a dotted action string uses the full compound identifier, not the short term.** Example: `workProject.stakeShares.manage`, not `workProject.stakes.manage`. The same rule applies to permission action strings, callable name segments, and any other identifier-shaped string: the noun is always the full compound. The short term only appears in UI-facing copy.

### Firestore collection names

Top-level collection names use the compound where the collection is domain-specific:

- `creators` → `artisanCreators` (string value) — but only if a collection by that name actually exists. If the concept lives as a subcollection of `userProfiles`, the rename applies to the subcollection name only.
- `skillsByTag` → `craftSkillsByTag`
- `streetzFeed` → `squareStreetzFeed`
- `donationsSummary` → `pledgePaymentsSummary` (platform-funding side; bouquet/appreciation side has its own collection per the Donation split edge case).
- `recentDonations` → `recentPledgePayments`
- `archivedDonations` → `archivedPledgePayments`
- `jobListings` → `commissionListings`
- `opportunityBoard` → `auditionBoard`
- `storyUniverses` → `workRealms`
- `allProjects` → `allWorkProjects`
- `userProfiles`, `publicUsers`, `pendingMedia`, `contentReports`, etc. — not renamed; not domain-vocabulary terms.

The `COLLECTIONS` constant key (the SCREAMING_SNAKE name on the left of the `=`) follows the same rule: `JOB_LISTINGS` becomes `COMMISSION_LISTINGS`, `STORY_UNIVERSES` becomes `WORK_REALMS`. Both the key and the string value rename together.

### Subcollection names

Subcollection names follow the same compound rule:

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

### React Query keys

React Query key factories (the function name) use compound: `creatorKeys` becomes `artisanCreatorKeys`. The string segments emitted by the factory also use compound: `['artisanCreator', uid, 'profile']`, not `['artisan', uid, 'profile']` and not `['creator', uid, 'profile']`.

### Cloud Function callable names

Callable names use compound (camelCase, no separator): `becomeCreator` becomes `becomeArtisanCreator`. Schema names follow: `BecomeCreatorInputSchema` becomes `BecomeArtisanCreatorInputSchema`. Type names follow: `BecomeCreatorInput` becomes `BecomeArtisanCreatorInput`.

### Route paths

Next.js route paths use kebab-case compound: `/artisan-creator/onboarding`, not `/artisan/onboarding`. The route folder under `src/app/` follows: `src/app/artisan-creator/onboarding/page.tsx`.

### Test IDs

`data-testid` values use kebab-case compound: `data-testid="artisan-creator-button"`, not `data-testid="artisan-button"`.

### UI strings inside JSX

UI text inside JSX (button labels, headings, paragraphs) uses the short new term: `<Button>Become an Artisan</Button>`, not `<Button>Become an ArtisanCreator</Button>`. The Button's `onClick` handler may still call `becomeArtisanCreator()` — code uses compound, UI uses short.

### Comments

Comments in code use the short new term: `// Find the artisan's most recent work`, not `// Find the artisanCreator's most recent workProject`. Comments are documentation, and the compound form is verbose reading.

### Pre-existing compound identifiers

Some old identifiers ALREADY use a compound form (`AcceptStreetzAgreementsInput`, `BecomeCreatorInputSchema`). These still get renamed in place: `AcceptStreetzAgreementsInput` becomes `AcceptSquareStreetzAgreementsInput`, `BecomeCreatorInputSchema` becomes `BecomeArtisanCreatorInputSchema`. The fact that the old form was already compound does not exempt it.

## Worked examples

### Type definition

Before:
```ts
export type Skill = {
  id: string;
  name: string;
  url: string;
  tags: string[];
  createdAt: number;
  type: 'image' | 'video' | 'audio';
};
```

After:
```ts
export type CraftSkill = {
  id: string;
  name: string;
  url: string;
  tags: string[];
  createdAt: number;
  type: 'image' | 'video' | 'audio';
};
```

### Hook with UI button

Before:
```tsx
function BecomeCreatorButton() {
  const becomeCreator = useBecomeCreator();
  return <Button onClick={() => becomeCreator.mutate()}>Become a Creator</Button>;
}
```

After:
```tsx
function BecomeArtisanCreatorButton() {
  const becomeArtisanCreator = useBecomeArtisanCreator();
  return <Button onClick={() => becomeArtisanCreator.mutate()}>Become an Artisan</Button>;
}
```

Note the asymmetry: code uses `BecomeArtisanCreator`/`becomeArtisanCreator`, UI string says "Artisan."

### Firestore collection constant

Before:
```ts
JOB_LISTINGS: 'jobListings',
OPPORTUNITY_BOARD: 'opportunityBoard',
```

After:
```ts
COMMISSION_LISTINGS: 'commissionListings',
AUDITION_BOARD: 'auditionBoard',
```

### Audit event emission

Before:
```ts
await writeAuditEvent({
  type: 'creator.grantedToUser',
  actorUid: uid,
  ...
});
```

After:
```ts
await writeAuditEvent({
  type: 'artisanCreator.grantedToUser',
  actorUid: uid,
  ...
});
```

### Comment

Before:
```ts
// Look up the creator's owned projects
const projects = user.ownedProjects ?? [];
```

After:
```ts
// Look up the artisan's owned works
const workProjects = user.ownedWorkProjects ?? [];
```

Variable name uses compound (`workProjects`), comment uses short form ("artisan's owned works"). Both rules applied at once.