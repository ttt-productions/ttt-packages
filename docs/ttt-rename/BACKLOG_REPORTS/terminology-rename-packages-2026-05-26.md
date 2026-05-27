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
