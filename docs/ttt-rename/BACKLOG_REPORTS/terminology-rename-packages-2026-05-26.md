packages/query-core/src/keys.ts | projects->entities query-key scope | code identifier, generic-package fixture (neutral replacement) | done
packages/query-core/src/react/firestore/use-firestore-doc.ts | project/projectId example->entity/entityId | comment, generic-package fixture (neutral replacement) | done
packages/query-core/src/react/firestore/use-firestore-collection.ts | projects/${projectId} examples->entities/${entityId} | comment, generic-package fixture (neutral replacement) | done
packages/query-core/src/firestore/types.ts | projects path example->entities path example | comment, generic-package fixture (neutral replacement) | done
packages/query-core/src/react/firestore/useBatchFirestoreDocs.ts | projects/public example->entities/public | comment, generic-package fixture (neutral replacement) | done
packages/query-core/__tests__/cache-helpers.test.ts | projects/pj-* fixtures->entities/e-* fixtures | generic-package fixture (neutral replacement) | done
packages/query-core/__tests__/keys.test.ts | projects scope fixture->entities scope fixture | generic-package fixture (neutral replacement) | done
packages/query-core/__tests__/domain-events/create-domain-event-invalidator.test.ts | project.published/projectId/projects fixtures->entity.published/entityId/entities | generic-package fixture (neutral replacement) | done
packages/query-core/__tests__/domain-events/cache-invalidation.test.ts | projects prefix fixture->entities prefix fixture | generic-package fixture (neutral replacement) | done
packages/chat-core/__tests__/mention-parser.test.ts | @[project...]/kind:project fixtures->@[entity...]/kind:entity | generic-package fixture (neutral replacement) | done
packages/chat-core/__tests__/MessageText.test.tsx | @[project...] fixture->@[entity...] fixture | generic-package fixture (neutral replacement) | done
packages/chat-core/src/mentions/types.ts | JSDoc "project" example->"entity" example | comment, generic-package fixture (neutral replacement) | done
packages/chat-core/src/types.ts | project membership doc example->entity membership doc example | comment, generic-package fixture (neutral replacement) | done
packages/chat-core/__tests__/queries.test.ts | projects/chatChannels/channelMessages fixtures->entities/channels/messages | generic-package fixture (neutral replacement) | done
packages/upload-ui/__tests__/use-upload-processing.test.tsx | fileOrigin streetz fixture->sample-origin | generic-package fixture (neutral replacement) | done
packages/upload-ui/__tests__/upload-activity-tray.test.tsx | fileOrigin streetz fixture->sample-origin | generic-package fixture (neutral replacement) | done
packages/upload-ui/__tests__/in-flight-uploads-provider.test.tsx | fileOrigin streetz and /streetz fixtures->sample-origin and /uploads-demo | generic-package fixture (neutral replacement) | done
packages/upload-ui/src/react/upload-activity-tray.tsx | JSDoc job-reply example->support-ticket example | comment, generic-package fixture (neutral replacement) | done
boundary verification | query-core | npm run typecheck --workspace=packages/query-core | pass
boundary verification | query-core | npm run build --workspace=packages/query-core | pass
boundary verification | query-core | npx vitest run --project query-core | fail->fixed fixtures in create-domain-event-invalidator.test.ts -> pass
boundary verification | upload-ui | npm run typecheck --workspace=packages/upload-ui | pass
boundary verification | upload-ui | npm run build --workspace=packages/upload-ui | pass
boundary verification | upload-ui | npx vitest run --project upload-ui | pass (stderr warnings only)
boundary verification | chat-core | npm run typecheck --workspace=packages/chat-core | pass
boundary verification | chat-core | npm run build --workspace=packages/chat-core | pass
boundary verification | chat-core | npx vitest run --project chat-core | fail->fixed fixtures in queries.test.ts -> pass
final discovery sweep (partial scope: query-core/chat-core/upload-ui) | remaining old-term hits in edited files resolved | done
step-34 generic-package grep (source-only) | non-zero hits are package-import strings like @ttt-productions/* and allowed identifiers like ttt-dev-cfb70; no new TTT-domain fixture leakage in edited files | done
SUMMARY | API-contract leakage discovered during rename | none in edited scope
SUMMARY | judgment calls | treated chat-core/query-core mention/query path literals as generic fixtures and neutralized to entity/sample-origin values per generic-package rule
final verification chain | npm run lint | pass
final verification chain | npm run typecheck | pass
final verification chain | npx tsc -b --noEmit | pass
final verification chain | npm run build | pass
final verification chain | npm run test | pass (with known stderr warnings in tests)
unexpected | PowerShell execution policy blocked npm/npx ps1; used npm.cmd/npx.cmd equivalents
unexpected | generic grep command in windows required source-only interpretation; residual hits were allowed import-scope strings (@ttt-productions/*) and fixture IDs (ttt-dev-cfb70)
packages/ttt-core/src/** and __tests__/** | broad Phase 3.75 terminology conversion pass (identifiers, Firestore strings, audit/action strings, comments where applicable) | code identifier, Firestore string, audit event, comment | done
path rename: packages/ttt-core/src/permissions/project-permissions.ts -> packages/ttt-core/src/permissions/work-project-permissions.ts | importers updated | done
path rename: packages/ttt-core/src/permissions/role-assignment-policy.ts -> packages/ttt-core/src/permissions/guild-standing-assignment-policy.ts | importers updated | done
path rename: packages/ttt-core/src/schemas/jobs.ts -> packages/ttt-core/src/schemas/commissions.ts | importers updated | done
path rename: packages/ttt-core/src/schemas/library.ts -> packages/ttt-core/src/schemas/hall-library.ts | importers updated | done
path rename: packages/ttt-core/src/schemas/project-management.ts -> packages/ttt-core/src/schemas/work-project-management.ts | importers updated | done
path rename: packages/ttt-core/src/schemas/skills.ts -> packages/ttt-core/src/schemas/craft-skills.ts | importers updated | done
path rename: packages/ttt-core/src/schemas/system-message-actions.ts -> packages/ttt-core/src/schemas/admin-dispatch-actions.ts | importers updated | done
path rename: packages/ttt-core/src/types/jobs.ts -> packages/ttt-core/src/types/commissions.ts | importers updated | done
path rename: packages/ttt-core/src/types/project.ts -> packages/ttt-core/src/types/work-project.ts | importers updated | done
path rename: packages/ttt-core/src/media/library-target-fields.ts -> packages/ttt-core/src/media/hall-library-target-fields.ts | importers updated | done
path rename: packages/ttt-core/src/upload-variables/* old-term files -> renamed commission/audition/work-project/track/episode/craft/work-asset equivalents | importers updated | done
path rename: packages/ttt-core/__tests__/permissions-project-roles.test.ts -> permissions-work-project-guild-standings.test.ts | done
path rename: packages/ttt-core/__tests__/schemas-project-management.test.ts -> schemas-work-project-management.test.ts | done
path rename: packages/ttt-core/__tests__/schemas-system-message-actions.test.ts -> schemas-admin-dispatch-actions.test.ts | done
boundary verification | ttt-core | npm run typecheck --workspace=packages/ttt-core | fail->fixed import/path casing and moved-module references -> pass
boundary verification | ttt-core | npm run build --workspace=packages/ttt-core | fail->fixed import/path casing and moved-module references -> pass
boundary verification | ttt-core | npx vitest run --project ttt-core | fail->fixed schema/test import paths -> pass
final discovery sweep (all packages source/test scope) | remaining hits classified: third-party imports (@testing-library), MIME/application strings, generic non-domain projectId config values, existing generic API-contract terms in query-core/notification-core comments | justified
step-34 generic-package grep result | no unresolved new leakage from this run; surviving matches are allowed identifiers/import scopes (e.g. @ttt-productions/*, ttt-prod references) or excluded ttt-core scope
final verification chain | npm run lint | pass
final verification chain | npm run typecheck | pass
final verification chain | npx tsc -b --noEmit | pass
final verification chain | npm run build | pass
final verification chain | npm run test | pass (with pre-existing jsdom/act stderr warnings)
packages/query-core/src/react/firestore/use-firestore-collection.ts | project wording in JSDoc example -> entity wording | comment, generic-package fixture (neutral replacement) | done
packages/query-core/src/react/firestore/use-firestore-doc.ts | queryKey example project -> entity | comment, generic-package fixture (neutral replacement) | done
packages/chat-core/src/types.ts | project membership wording -> entity membership wording | comment, generic-package fixture (neutral replacement) | done
packages/notification-core/src/types.ts | /projects/abc example -> /entities/abc | comment, generic-package fixture (neutral replacement) | done
final discovery sweep (all packages) | remaining matches are classified: third-party imports (@testing-library/*), MIME/application terms, config projectId references, and intentional compound identifiers containing old grep-anchor suffixes (e.g., workProject*) | justified
API-contract leakage discovered during rename | query-core library key scope remains exported API contract terminology (library). Left unchanged for user review per generic-package rule.

CHATGPT V1 REVIEW CORRECTIVE PASS
- scope | packages/ttt-core/src/** and packages/ttt-core/__tests__/** corrective pass focused on stale exported identifiers, Firestore collection keys/values, path builders/refs, and test assertions | done
- packages/ttt-core/src/paths/collections.ts | corrected key/value renames: ALL_WORK_PROJECTS, WORK_REALMS, SQUARE_STREETZ_FEED, COMMISSION_LISTINGS, AUDITION_BOARD, PLEDGE_PAYMENTS_SUMMARY, RECENT_PLEDGE_PAYMENTS, ARCHIVED_PLEDGE_PAYMENTS, GUILD_INVITE_CONVERSATIONS, STAKE_SHARE_AUDIT_EVENTS, CRAFT_SKILLS_BY_TAG='craftSkillsByTag', USER_PLEDGE_PAYMENTS, AUDITION_VOTES, TUNE_TRACKS, TELEVISION_EPISODES, COMMISSION_PROPOSALS, AUDITION_ENTRIES; migrated PROJECT_SUBCOLLECTIONS -> WORK_PROJECT_SUBCOLLECTIONS names | done
- packages/ttt-core/src/paths/path-builders.ts | renamed stale exports and IDs: workProjectPublicData/workProjectTale/workProjectTune/workProjectTelevision/workProjectGuildmateUser/workProjectAsset/guildChatChannel/guildChatMessage/commissionProposal/pledgePaymentsSummary/recentPledgePayment/archivedPledgePayment/taggedCraftSkill; fixed stale parameter IDs (workProjectId, commissionListingId, commissionProposalId, auditionId, auditionEntryId, workRealmId, adminDispatchId, hallItemId, workAssetId, guildChatChannelId, guildChatMessageId) and tuple constant refs | done
- packages/ttt-core/src/paths/collection-refs.ts | renamed stale exports and parameters to workProject* + commissionProposal/auditionEntries naming and updated constant refs to WORK_PROJECT_SUBCOLLECTIONS + GUILD_CHAT_MESSAGES | done
- packages/ttt-core/src/paths/collection-groups.ts | renamed stale group keys CHANNEL_MESSAGES -> GUILD_CHAT_MESSAGES and TAGGED_SKILLS -> TAGGED_CRAFT_SKILLS | done
- packages/ttt-core/__tests__/collections.test.ts | updated to WORK_PROJECT_SUBCOLLECTIONS naming | done
- packages/ttt-core/__tests__/collection-refs.test.ts | updated to WORK_PROJECT_SUBCOLLECTIONS and GUILD_CHAT_MESSAGES naming | done
- packages/ttt-core/__tests__/collection-groups.test.ts | updated expected group keys to GUILD_CHAT_MESSAGES and TAGGED_CRAFT_SKILLS | done
- packages/ttt-core/__tests__/path-builders.test.ts | updated expectations to renamed constants/subcollections and PATH_BUILDERS.commissionProposal API | done
- boundary verification | ttt-core | npm.cmd run typecheck --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npm.cmd run build --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npx.cmd vitest run --project ttt-core | pass
- final verification chain | npm.cmd run lint | pass
- final verification chain | npm.cmd run typecheck | pass
- final verification chain | npx.cmd tsc -b --noEmit | pass
- final verification chain | npm.cmd run build | pass
- final verification chain | npm.cmd run test | pass
- discovery result (post-pass) | old-term hits still exist in ttt-core for broader families (schemas/media/permissions/types/constants/upload-variables), including projectId/project* schema fields, ProjectRole/ProjectAction naming, chat schema threadKind projectChannel, media target/domain event projectId fields, and additional role/job/opportunity/library/song/show identifiers | NOT fully resolved in this corrective pass
- deferral | broad docs/package-doc cleanup intentionally deferred per prompt; only run-report updated | deferred
- API-contract leakage discovered during rename (generic packages, left unchanged per rule) | packages/query-core/src/keys.ts exports keys.library, keys.opportunities, keys.jobs, keys.donations, keys.skills and mirrored expectations in packages/query-core/__tests__/keys.test.ts; these remain exported API-contract leakage for user-directed follow-up | flagged

CHATGPT V2 REVIEW CORRECTIVE PASS
- scope | packages/ttt-core/src/{schemas,media,permissions,types,upload-variables,constants}/** + packages/ttt-core/__tests__/** + related barrels/index exports | corrective rename completion for Phase 3.75 package-side terminology | done
- packages/ttt-core/src/permissions/work-project-permissions.ts | PROJECT_* -> GUILD_STANDINGS/WORK_PROJECT_ACTIONS API rename; standing IDs renamed (WorkProjectManager/PublicWorkProjectEditor/GuildStandingManager/StakeShareManager/WorkAsset*/CommissionManager/AuditionManager/HallLibrary*/GuildChatChannelManager); dotted action strings renamed to guildStanding/stakeShares/guildInvite/workAsset/commissionProposal/tuneTrack/televisionEpisode/guildChatChannel/guildChatMessage forms | code identifier, action string, comment/UI label alignment | done
- packages/ttt-core/src/permissions/guild-standing-assignment-policy.ts | role-assignment API renamed to GuildStanding naming; NON_ASSIGNABLE and STEWARD_ONLY assignment constants finalized | code identifier, policy contract | done
- packages/ttt-core/src/schemas/** | stale schema exports and fields fully renamed (admin-dispatch/chat/commissions/craft-skills/hall-library/auditions/share-operation/social/users/work-project-management/utility); projectId/jobId/opportunityId/replyId/skillId/libraryType/requiredRoles/threadKind projectChannel/messageId(admin dispatch) stale fields replaced with workProjectId/commissionListingId/auditionId/auditionEntryId/craftSkillId/hallWingType/requiredGuildStandings/guildChatChannel/adminDispatchId | code identifier, schema field contract, callable wire shape | done
- packages/ttt-core/src/schemas/opportunities.ts -> packages/ttt-core/src/schemas/auditions.ts | stale schema filename removed; barrel export updated | filename + barrel export | done
- packages/ttt-core/src/media/file-origin.ts | stale origins renamed: craft-skill-media, commission-proposal, audition-entry, tune-track-*, television-episode-*, guild-chat-message-attachment, work-asset | fileOrigin contract string | done
- packages/ttt-core/src/media/target-info.ts | stale target schema/type names renamed (CraftSkill/SquareStreetz/Commission/Audition/TuneTrack/TelevisionEpisode/WorkAsset); stale field names and threadKind literals renamed; parse dispatch updated | code identifier, discriminant string, field contract | done
- packages/ttt-core/src/media/domain-events.ts | stale event schema identifiers renamed (CraftSkill/SquareStreetz/AuditionEntry/Commission*/WorkProject*/GuildInvite*); stale id field names renamed (workProjectId/commissionListingId/commissionProposalId/auditionId/auditionEntryId/guildChatMessageId/adminDispatchId where applicable); sub-item itemType values updated to chapter/tuneTrack/televisionEpisode | code identifier, event payload contract | done
- packages/ttt-core/src/media/upload-tray-display.ts + hall-library-target-fields.ts + media/index.ts | labels and exports aligned to renamed origins/types | UI string + barrel export | done
- packages/ttt-core/src/types/work-project.ts | ShortWorkProject/GuildmateUser/WorkAsset/PendingStakeShares/FullWorkProject/PublicWorkProject/GuildInvite terminology completed; hallWingType, guildmateUserIds, pendingStakeShares, origin new/existingWorkRealm finalized | type identifier + field contract | done
- packages/ttt-core/src/types/commissions.ts | CommissionAttachment/FullCommissionListing/CommissionProposal/AuditionType/AuditionEntry/UserAuditionVote terminology completed; stale fields renamed (stakeSharesOffered/sponsoredAuditionAmountUSD/etc.) | type identifier + field contract | done
- packages/ttt-core/src/types/content.ts | HallWing/WorkProject type-key constants and filter types renamed; Threshold/Hall item field names normalized (hallItemId/hallWingType/workProjectType); published stats and sort option renamed to pledge terminology; RuleGroup libraryType->hallWingType | type identifier + field contract | done
- packages/ttt-core/src/types/social.ts + messaging.ts + user.ts + audit.ts | SquareStreetz and messaging/admin-dispatch naming finalized; donation/streetz/opportunity/job/song/show stale event/type members renamed to pledge/audition/commission/tuneTrack/televisionEpisode/guildChat forms | type identifier, event string, field contract | done
- packages/ttt-core/src/upload-variables/** | stale variable fields renamed (commissionListingId/workProjectId/auditionId/stakeSharesOffered/commissionListingData/sponsoredAuditionAmountUSD); WorkAsset typing updated | upload variable contract | done
- packages/ttt-core/src/constants/business.ts/options.ts/pagination.ts/retention.ts | stale constant names completed (MAX_WORK_PROJECT_*, MAX_COMMISSION_*, MAX_TUNE_TRACK_*, MAX_TELEVISION_EPISODE_*, PLEDGE_*; TRADE_PROFESSION_OPTIONS/CRAFT_SKILL_TAG_OPTIONS/WORK_PROJECT_SPECIFIC_GENRES/HALL_WING_TYPES/WORK_PROJECT_TYPES/AUDITION_SORT_OPTIONS/HALL_LIBRARY_SORT_OPTIONS; pagination + retention pledge naming) | constant identifier + field key contract + comments | done
- packages/ttt-core/__tests__/** | tests updated to assert renamed API/fields (permissions, admin-dispatch-actions, work-project-management, media-target-info, media-domain-events, content-types, types-audit, and related suites) | test contract alignment | done
- boundary verification | ttt-core | npm.cmd run typecheck --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npm.cmd run build --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npx.cmd vitest run --project ttt-core | fail (content-types stale key names) -> fixed __tests__/content-types.test.ts -> pass
- final verification chain | npm.cmd run lint | pass
- final verification chain | npm.cmd run typecheck | pass
- final verification chain | npx.cmd tsc -b --noEmit | pass
- final verification chain | npm.cmd run build | pass
- final verification chain | npm.cmd run test | pass (with known pre-existing stderr warnings in jsdom/act/navigation/canvas mocks)
- final discovery sweep (packages/ttt-core/src/** + __tests__/** old-term anchors) | remaining hits: packages/ttt-core/src/paths/collections.ts comment {projectId}; packages/ttt-core/src/paths/path-builders.ts parameter skillId | justified: path/collections layer intentionally left stable per scope rule (no broad rework outside required import/type alignment)
- family completion status | schemas/media/permissions/types/upload-variables/constants/tests | complete for requested Phase 3.75 corrective pass
- generic-package API leakage findings | unchanged from prior report: query-core exported API-contract keys.* legacy names remain intentionally untouched pending explicit user direction

CHATGPT V3 REVIEW CORRECTIVE PASS
- scope | surgical v4 corrective pass on packages/ttt-core/src/** + packages/ttt-core/__tests__/** for verified leftovers only (commission proposal IDs, stake-share operation naming, guild standing policy fields/values, guild invite IDs, profile craft-skill path/group keys, domain event strings/names, admin task/audit/library-share-message strings, discovery truthfulness) | done
- docs re-read | docs/ttt-rename/terminology-naming-convention.md + docs/ttt-rename/PHASE_3_75_TERMINOLOGY.md + docs/ttt-rename/generic-package-terminology-rule.md | done
- packages/ttt-core/src/schemas/atoms.ts | added/used commissionProposalIdSchema + guildInviteIdSchema atoms for contract-specific IDs | code identifier + schema atom contract | done
- packages/ttt-core/src/types/commissions.ts + src/schemas/commissions.ts | CommissionProposal and commission proposal input schemas now use commissionProposalId (not auditionEntryId); guild invite reference renamed to guildInviteId | type/schema field contract | done
- packages/ttt-core/__tests__/schemas-commissions.test.ts | added explicit coverage that commissionProposalId is accepted and legacy auditionEntryId is rejected in commission proposal inputs | regression coverage | done
- path rename: packages/ttt-core/src/schemas/share-operation.ts -> packages/ttt-core/src/schemas/stake-share-operation.ts | imports/exports/tests updated; old share-operation filename removed | filename + barrel contract | done
- path rename: packages/ttt-core/__tests__/schemas-share-operation.test.ts -> packages/ttt-core/__tests__/schemas-stake-share-operation.test.ts | updated import path and suite references | filename contract | done
- packages/ttt-core/src/schemas/stake-share-operation.ts + src/types/work-project.ts | renamed type exports ShareOperation/PublicShareOperation -> StakeShareOperation/PublicStakeShareOperation; removed stale old-term comments (manageProjectShares/inviteUserToProject/createProject/shareOperations/executeShareOperation/projectData wording) | type export + comment accuracy | done
- packages/ttt-core/src/permissions/guild-standing-assignment-policy.ts | exported arg fields renamed: actorIsStewardOwner, actorGuildStandings, targetGuildStanding; local role/roles wording removed for work standing concept | API field contract | done
- packages/ttt-core/src/permissions/work-project-permissions.ts | introduced explicit code-identifier vs stored-value layer via GUILD_STANDING_VALUE_BY_ID/GUILD_STANDING_VALUES; added isGuildStandingValue/getGuildStandingIdFromValue/getGuildStandingValueFromId; getActionsForGuildStanding parameter renamed; stale UI labels updated (Share Manager/Chat Channel Manager wording) | standing wire/code contract + label cleanup | done
- packages/ttt-core/__tests__/permissions-work-project-guild-standings.test.ts + src/schemas/work-project-management.ts | schema and tests now validate stored guild-standing values (including Steward) instead of code identifiers as wire values; policy tests updated to new arg names and standing value layer | wire-value contract + test alignment | done
- StewardOwner stored-value decision | implemented doc-backed split: code identifier remains StewardOwner (GuildStandingId), stored/wire standing value is Steward via GUILD_STANDING_VALUE_BY_ID and GUILD_STANDING_VALUES; UpdateGuildmateStandingInputSchema now accepts Steward and rejects StewardOwner | resolved per convention edge-case | done
- packages/ttt-core/src/types/work-project.ts + src/types/messaging.ts + src/schemas/chat.ts + src/schemas/admin-dispatch-actions.ts + src/media/target-info.ts + related tests | work/guild field leftovers fixed: roles->guildStandings, sharesNumber->stakeShareCount, pending stake share index key inviteId->guildInviteId, GuildInvite.inviteId->guildInviteId; guild invite IDs in chat/admin-dispatch/media target contracts now use guildInviteId | field contract + ID contract | done
- packages/ttt-core/src/paths/collections.ts + src/paths/path-builders.ts + src/paths/collection-groups.ts + src/paths/collection-refs.ts + related tests | profile craft-skill leftovers fixed: PROFILE_SKILLS->PROFILE_CRAFT_SKILLS key, COLLECTION_GROUPS.PROFILE_CRAFT_SKILLS, PATH_BUILDERS.userCraftSkill(userId, craftSkillId); stale path comments updated (PROJECT/STREETZ/LIBRARY/JOB/OPPORTUNITY/UNIVERSE/SKILLS headings) | path/key contract + comment accuracy | done
- packages/ttt-core/src/media/domain-events.ts | domain event schema names and strings finalized: audition.entryCreated/entryVoted, commission.commissionProposalSubmitted/Saved/Removed, workProject.stakeSharesUpdated, workProject.guildInvite*; libraryAsset.* and message.* removed; renamed schema identifiers (CraftSkill*/HallLibrary*/ThresholdLibrary*/AdminDispatch*); libraryId replaced with thresholdItemId/hallItemId as appropriate | event string + event payload contract | done
- packages/ttt-core/src/types/audit.ts + src/types/admin.ts + src/schemas/admin.ts + src/types/content.ts + src/constants/business.ts + src/constants/pagination.ts + related tests | audit/admin old-term cleanup: admin.thresholdLibraryItemReviewed, content.thresholdLibraryItemSubmitted, content.hallLibraryItemPublished, thresholdLibraryReview, stakeShareAnomaly, admin dispatch constant names, craft-skill pagination constant, hall library constant name, feedback types tradeProfessionSuggestions/craftSkillTagSuggestions, PublishedHallItem rename to remove libraryItem token | audit/admin/constants contract + naming accuracy | done
- boundary verification | ttt-core | npm.cmd run typecheck --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npm.cmd run build --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npx.cmd vitest run --project ttt-core | pass
- final verification chain | npm.cmd run lint | pass
- final verification chain | npm.cmd run typecheck | pass
- final verification chain | npx.cmd tsc -b --noEmit | pass
- final verification chain | npm.cmd run build | pass
- final verification chain | npm.cmd run test | pass (with pre-existing stderr warnings in jsdom/act/navigation/canvas mocks)
- final discovery (required stale set) | no real stale-contract hits remain for: commission proposal ID misuse in commission schemas/types, ShareOperation/PublicShareOperation symbols, actorIsOwner/actorRoles/targetRole, sharesNumber, inviteId (guild-invite contexts), PROFILE_SKILLS key, LibraryAsset/libraryAsset strings, libraryId payload keys, applicationSubmitted/applicationSaved/applicationRemoved, replyCreated/replyVoted, sharesUpdated, libraryReview, shareAnomaly, libraryItem, AdminMessage/adminMessage/systemMessage, SKILLS_PER_PAGE, LIBRARY_CONSTANTS | done
- final discovery justified residuals | (1) auditionEntryId remains in real audition contracts only (audition entry types/schemas/events and optional short-link payload), not in commission proposal contracts; (2) share-operation appears only as the required new filename segment stake-share-operation per explicit rename target, not as old exported symbol/contract | justified and documented

CHATGPT V3 REVIEW CORRECTIVE PASS
- scope | packages/ttt-core/src/** + packages/ttt-core/__tests__/** surgical corrective pass for verified v3 leftovers only (commission proposal IDs, stake-share operation naming, guild standing policy fields, guild invite IDs, profile craft path/group keys, domain events, admin/audit task strings, and discovery truthfulness) | done
- packages/ttt-core/src/schemas/atoms.ts | added commissionProposalIdSchema and guildInviteIdSchema; removed old inviteIdSchema contract usage | schema atom contract | done
- packages/ttt-core/src/types/commissions.ts + packages/ttt-core/src/schemas/commissions.ts + packages/ttt-core/src/schemas/work-project-management.ts + packages/ttt-core/__tests__/schemas-work-project-management.test.ts + packages/ttt-core/__tests__/schemas-commissions.test.ts | Commission Proposal ID contract corrected to commissionProposalId/commissionProposalIdSchema; legacy auditionEntryId rejected for commission-proposal inputs; audition-entry contracts preserved where actually audition-specific | proposal-vs-entry wire contract | done
- path rename | packages/ttt-core/src/schemas/share-operation.ts -> packages/ttt-core/src/schemas/stake-share-operation.ts | imports/exports/tests updated, no old compatibility exports retained | done
- packages/ttt-core/src/schemas/stake-share-operation.ts + packages/ttt-core/src/types/work-project.ts + packages/ttt-core/src/schemas/index.ts + packages/ttt-core/__tests__/schemas-stake-share-operation.test.ts | ShareOperation/PublicShareOperation names completed to StakeShareOperation/PublicStakeShareOperation variants; stale comments updated to renamed callable/domain concepts | type/export/comment contract | done
- packages/ttt-core/src/permissions/guild-standing-assignment-policy.ts + packages/ttt-core/src/permissions/work-project-permissions.ts + packages/ttt-core/src/schemas/work-project-management.ts + packages/ttt-core/__tests__/permissions-work-project-guild-standings.test.ts | guild-standing policy API fields finalized: actorIsStewardOwner, actorGuildStandings, targetGuildStanding; role/owner wording removed where guild-standing concept is intended; getActionsForGuildStanding parameter naming kept guild-standing safe | guild-standing policy contract | done
- standing stored-value decision | Implemented explicit code-ID vs stored-value layer in work-project-permissions: GUILD_STANDING_IDS keep code identifiers (including StewardOwner) and GUILD_STANDING_VALUE_BY_ID maps stored wire value to Steward for StewardOwner; UpdateGuildmateStandingInputSchema and canAssignGuildStanding now validate stored guild-standing values; reasoning aligns with terminology convention edge case "Owner -> Steward standing value" while preserving grep-safe code identifiers | done
- packages/ttt-core/src/types/work-project.ts + packages/ttt-core/src/types/messaging.ts + packages/ttt-core/src/schemas/chat.ts + packages/ttt-core/src/schemas/admin-dispatch-actions.ts + packages/ttt-core/src/media/target-info.ts + packages/ttt-core/src/media/domain-events.ts + related tests | guild invite ID fields normalized to guildInviteId (and guildInviteIdSchema) across work/guild/message/media contracts | ID field contract | done
- packages/ttt-core/src/paths/collections.ts + collection-groups.ts + collection-refs.ts + path-builders.ts + related tests | profile craft skill path/group keys finalized to PROFILE_CRAFT_SKILLS; PATH_BUILDERS.userCraftSkill now uses craftSkillId parameter/segment; stale section comments updated (Work/Square/Hall/Commission/Audition/Realm/Craft wording) | path/group key + comment contract | done
- packages/ttt-core/src/media/domain-events.ts + __tests__/media-domain-events.test.ts | domain-event literals/names corrected for leftovers: audition.entryCreated/entryVoted, commission.commissionProposalSubmitted/Saved/Removed, workProject.stakeSharesUpdated, workProject.guildInvite*; removed libraryAsset/libraryId/message/systemMessage literals; replaced with hall/threshold/adminDispatch naming and guildInviteId field keys | domain event wire strings | done
- packages/ttt-core/src/types/audit.ts + src/types/admin.ts + src/schemas/admin.ts + src/constants/business.ts + src/constants/pagination.ts + __tests__/schemas-utility.test.ts + __tests__/path-builders.test.ts | admin/audit leftovers completed: thresholdReview/stakeShareAnomaly task names, threshold/hall audit strings, admin-dispatch constant names, pagination constant renames, feedback type string updates (tradeProfessionSuggestions/craftSkillTagSuggestions), and stale old labels removed | admin/audit/constants contract | done
- boundary verification | ttt-core | npm.cmd run typecheck --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npm.cmd run build --workspace=packages/ttt-core | pass
- boundary verification | ttt-core | npx.cmd vitest run --project ttt-core | pass
- final verification chain | npm.cmd run lint | pass
- final verification chain | npm.cmd run typecheck | pass
- final verification chain | npx.cmd tsc -b --noEmit | pass
- final verification chain | npm.cmd run build | pass
- final verification chain | npm.cmd run test | pass (with pre-existing stderr warnings in jsdom/act/navigation/canvas mocks)
- final discovery sweep (targeted old-term checklist over packages/ttt-core/src + __tests__) | no remaining real old-contract misses in requested buckets; remaining grep hits are truthful false-positive substrings from approved new names (StakeShareOperation contains ShareOperation; stake-share-operation path contains share-operation) and intentional auditionEntryId usage in actual audition contracts (not commission-proposal contracts) | justified
- remaining concerns | domain-event noun choices for hall/threshold/adminDispatch were aligned to convention and stale-term removal, but downstream registry consumers in ttt-prod should be checked for synchronized event-literal updates before runtime deployment | follow-up note
