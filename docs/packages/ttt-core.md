# @ttt-productions/ttt-core

TTT Productions application-data package.

## Owns

- TTT-specific types, schemas, constants, paths, and business rules
- Concrete `FileOrigin` and `TTT_MEDIA_SPECS`
- Upload wire schemas, target-info schemas, `parseTargetInfo`, and server-owned hall-library upload target-field mappings
- Concrete TTT pending-media schemas composed from `media-schemas`
- TTT domain-event union/schema/catalog
- TTT atoms such as `ShortWorkProject`, `Mention`, and `MentionType`
- TTT moderation constants
- TTT upload-variable schemas
- TTT mention kinds/schemas/validation rules
- TTT admin task type union
- Work invite source schemas/types (`InviteSource`, `InviteSourceType`) for standalone, craft-skill, commission, and audition invite origins
- Work stake-share-operation schemas/types, including the invite-only pending-stake-share reservation contract
- Work guild-standing IDs, action IDs, action grants, and guild-standing-assignment policy
- Commission proposal lifecycle schemas/types (`open`, `invited`, `accepted`, `rejected`)
- `AuditEventType` catalog, `TTTAuditActor`, `TTTAuditTarget`, and `TTTAuditEvent` specialization of the `@ttt-productions/audit-core` generic
- **Chat-edge-rebuild concrete contracts (P1):**
  - The frozen deterministic ID/`hash()` helpers in `src/ids/chat-ids.ts`
    (canonical domain-tagged SHA-256 via `edge-protocol-core`'s runtime-neutral
    `sha256Hex`; ALL async): `channelKey`/`authPairKey`, the `chatSyncEvents`
    eventIds, `chatSyncFanoutJobId`, the degraded-cause/scope keys, the inbox
    projection eventId, `notificationDeliveryId`/`activeNotificationDocId`/archive
    ids, the moderation audit ids, and `chatAnonymizeJobId`.
  - The new Admin-SDK-only Firestore doc-schemas: `notificationDeliveries` +
    `notificationFanoutJobs` (delivery ledger / fanout engine) and the chat-sync
    set `chatChannelAuthProjections`, `chatScopeDegraded` (+ `causes`),
    `chatSyncEvents`, `chatSyncFanoutJobs`, `chatMessageOutbox`,
    `chatAdminActionCommands` — all wired into `COLLECTIONS`, `PATH_BUILDERS`, and
    the CI-enforced `COLLECTION_SCHEMAS` registry.
  - The `chat.moderationAction{Requested,Applied,Failed}` audit types.
  - Version-init fields (backend-only, with frozen ABSENT defaults): user
    `accountAccessVersion`/`accountAccessState` (absent ⇒ `{0, 'active'}`) and
    `GuildmateUser.guildAuthInputVersion` (absent ⇒ 0), plus the
    `activityGeneration`/`seenAtGeneration` opaque-token fields on the active
    notification doc.

## Boundary

`ttt-core` may depend on generic packages. Generic packages must not depend on `ttt-core`.

Generic admin/report shapes live in `report-core`. Pure chat schemas live in `chat-schemas`. Generic media shapes/factories live in `media-schemas`.


## Work invite and stake-share-contract ownership

`ttt-core` owns the shared wire/data contracts for work invite creation and stake-share operations. The app must consume these contracts instead of redefining local interfaces.

Current membership invariant:

- `InviteUserToGuildInputSchema` requires an `InviteSource` discriminated union.
- `PendingStakeShares` is keyed by invite conversation ID and stores only reservation amount/timestamp.
- Stake-share operations do not carry a pending-stake-share `sourceType`; pending reservations are invite reservations.
- Commission/audition source variants carry compact context plus the posting stake-share floor. They do not carry old commission-proposal/audition-entry message or media payloads.
- Commission proposal status is modeled as `open -> invited -> accepted` or `open -> rejected`; guild membership still comes only from invite finalization.

When adding a new invite source or commission-proposal lifecycle state, update the schema here first and then publish/consume it in `ttt-prod`. Do not add parallel frontend/backend interfaces in the app.


## Work guild-standing and action ownership

`ttt-core` owns the work guild-standing contract consumed by both `ttt-prod` frontend code and Cloud Functions code. The durable source files are:

- `src/permissions/work-project-permissions.ts` — `GUILD_STANDINGS`, `WORK_PROJECT_ACTIONS`, guild-standing/action type guards, and helpers.
- `src/permissions/guild-standing-assignment-policy.ts` — who may assign or remove each guild standing.
- `src/schemas/work-project-management.ts` — guild-standing/trade-profession update callable input schemas.

Consumers should not duplicate guild-standing option maps or action matrices locally. UI affordances may read the package catalog, but backend work-project-action checks remain authoritative in the consuming app.

The launch-era steward model is guild-standing-based: `StewardOwner` is the first `GuildStandingId`, appears in every `WORK_PROJECT_ACTIONS[action].grantedTo` list, and is stored on the consuming app's `allWorkProjects/{workProjectId}/guildmateUsers/{uid}.guildStandings` guildmate document. `StewardOwner` is still non-assignable through the normal guild-standing-management policy; work creation seeds it, and future steward-transfer/co-steward work must design a dedicated flow instead of bypassing `canAssignGuildStanding`.


## Upload target authority

Hall-library cover and sub-item upload `targetInfo` schemas carry typed ids only. They must not accept client-provided Firestore paths or field maps. The consuming backend derives final document paths through `PATH_BUILDERS` and derives media URL fields through `HALL_LIBRARY_TARGET_FIELDS` from `src/media/hall-library-target-fields.ts`.

When adding a new media origin that writes back to Firestore, add the target-info schema and any target-field mapping here first, then publish and consume it in `ttt-prod`. Do not let application code reconstruct the old `{ docPath, fields }` pattern locally.

Target-info schemas may carry user-authored domain payload, but they must not make client-supplied identity authoritative. Do not add `createdBy`, `userId`, `actorId`, owner/admin identity, or recipient identity fields to new target-info shapes unless the consuming backend derives the value from auth / `pendingMedia.userId` or verifies exact equality before persistence.

## Realm / Work discovery contract ownership

`ttt-core` owns the shared Realm/discovery launch contracts before `ttt-prod` adopts them. Do not define parallel app-only interfaces, schemas, path helpers, or business constants for these shapes.

The old nested public Work projection contract must stay removed: do not keep `WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_DATA` or `PATH_BUILDERS.workProjectPublicData(...)` as launch-era APIs. `publicWorkProjects/{workProjectId}` is the only Work shell/search projection.

Keep the detailed contract shape in source types, schemas, constants, and tests rather than in this doc. The package-level ownership rule covers Realm and public Work projection types, create/edit schemas, Mention/Square related-id contracts, PublicUser search/display requirements, hidden flags on published Hall projections, and the non-person founding-Work stake-holder contract for Works built into an existing public Realm.

Realm docs store no child Work arrays, no counts, no Realm image fields, and no denormalized owner display fields. Display identity remains uid-only across package boundaries; consuming apps resolve names/avatars from their own public identity source.
