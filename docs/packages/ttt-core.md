# @ttt-productions/ttt-core

TTT Productions application-data package.

## Owns

- TTT-specific types, schemas, constants, paths, and business rules
- Concrete `FileOrigin` and `TTT_MEDIA_SPECS`
- Upload wire schemas, target-info schemas, `parseTargetInfo`, and server-owned hall-library upload target-field mappings
- Concrete TTT pending-media schemas composed from `media-schemas` (the optional `processingAttemptCount`/`processingLeaseExpiresAt` crash-recovery fields ride the composed strict branches)
- Media-processing crash-recovery policy constants (`constants/media-processing` → `constants` barrel): `MEDIA_PROCESSING_MAX_ATTEMPTS` (2 — first attempt + one retry) and `MEDIA_PROCESSING_LEASE_MS` (12 min)
- The TTT account-password contract: `PASSWORD_MIN_LENGTH` (7) / `PASSWORD_MAX_LENGTH` (64) in `constants/business-user`, plus the single `validateTttPassword` owner in `utils/password`. Length only — no composition rules — counted in UTF-16 code units to match HTML inputs and the Firebase SDK, never trimming or normalizing, and confirmation matching stays the caller's job. Deliberately NOT named `validatePassword`: Firebase's SDK owns that name and reads mutable hosted project policy, while this is the stable product contract every TTT password surface (registration, reset) and the hosted Firebase policy derive from.
- TTT domain-event union/schema/catalog
- The Hall content SURFACE vocabulary: `HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE`
  (`constants/hall-content-routing`) is the one declaration of the per-work-type detail and
  sub-item surface identities, and ships the `HALL_CONTENT_DETAIL_SURFACES` /
  `HALL_CONTENT_SUB_ITEM_SURFACES` tuples projected from it. Every enum-shaped consumer —
  the `hallLibrary.coverUpdated` / `hallLibrary.subItemUpdated` domain events, the hall-library
  cover `targetInfo`, and `HallContentTextSurfaceSchema` — derives from those tuples, so a new
  `WorkProjectType` cannot leave one behind.
- The Hall sub-item KIND per work type: `HALL_SUB_ITEM_TYPE_BY_WORK_TYPE` (`paths/collections`, root +
  `./paths`, beside `HALL_ITEM_SUBCOLLECTION_BY_WORK_TYPE`) maps each `WorkProjectType` to the
  `HallSubItemType` (`chapter` / `track` / `episode`) that notification metadata and Streetz
  payloads carry. Its values are typed against that union rather than read off its schema, so the
  paths module stays free of zod at runtime. A stored or untrusted work type is checked with the
  existing `workProjectTypeSchema` (`./schemas`) — there is no second work-type guard.
- TTT atoms such as `Mention` and `MentionType`
- TTT moderation constants
- The Company / Green Room mascot **contract + content** (`constants/company-mascots`): the pure `CompanyCharacterId` / billing-kind / `CompanyPerformanceIntent` / selectable-companion unions, roster + selectable arrays, the rich-copy `CompanyCopySegment` / `CompanyCopyBlock` model (with semantic `CompanyNavigationTarget`s, not URLs), the `COMPANY_MASCOTS` registry, and the DJ-approved verbatim studies / click lines / footers / switch exchanges / Yorick block lines / signed-out dock lines / onboarding cameos. Pure data only — no React/JSX/Next/CSS/SVG; the app owns the render adapter, puppets, rig, and choreography. Canonical dialogue lives here, never Firestore.
- The Center Stage revolving-room definitions (`constants/center-stage-rooms` — `CENTER_STAGE_ROOMS`); the app keeps `ROOM_EMBLEMS`, components, and layout
- Media **activation-job dependency fields**: the optional `parentKey` + `parentWaitStartedAt` (Firestore `Timestamp`, like the job's other time fields) on `MediaActivationJobSchema`. `parentKey` marks a job minted on an absent-parent identity lane — a curated-audition ENTRY publication whose parent audition doc is created by the PROMPT's publish — so a parent-absent publication can be parked instead of burning the retry budget, and so the prompt's publish can wake its parked siblings. `parentWaitStartedAt` stamps the first parent-absent occurrence and never moves forward. Both optional: rows predating them still parse. The park interval and wait cap are app-side runner policy, not package constants.
- **Media copy intents** (`./doc-schemas` — `MediaCopyIntentSchema` / `MediaCopyIntentStateSchema`): the server-only record of one cross-owner media copy in flight at `mediaCopyIntents/{newAssetId}` (`COLLECTIONS.MEDIA_COPY_INTENTS`, `PATH_BUILDERS.mediaCopyIntent`, `COLLECTION_REFS.mediaCopyIntents`, registry-bound), keyed by the copy's deterministic new asset id. A copy writes its variant objects before its asset doc exists; the intent is recorded before the first object is copied and cleared in the transaction that creates that asset doc, so an intent that outlives its copy names exactly the objects to reclaim. It carries the source asset id, the new owner (`ownerType` from `MediaAssetOwnerTypeSchema`), the variant NAMES copied (canonical `MediaVariantKey`s, at least one and each at most once — object keys derive from an asset id and a variant, never stored), a `state` of `copying` or `reaping`, epoch-ms `createdAt` / `updatedAt`, and `reapClaimedAt`, present exactly when the intent is `reaping`. The sweep schedule rides on the intent: `reapAfter` (epoch ms, required) is the earliest time the sweep may take it up, and the sweep lists due intents ordered by it — recording sets it a grace period out, and a deferral pushes it out again, so an intent that cannot finish yet (a held or unreadable source, a failing delete) rotates behind the ones that can instead of holding the head of every page. It is never earlier than `updatedAt`, so a re-recorded intent must move it too. `reapAttemptCount` (required, starts at 0) counts the times the sweep took the intent up and deferred it, which is what its backoff grows from. The grace and the backoff are the reaper policy constants below, not schema. It has no native-TTL field: an intent removed before its objects are reclaimed strands them.
- **Singleton audience buckets** (BACKEND-108): a singleton's bucket is its read grant — `_appConfig` public, `_systemData` signed-in, `_serverData` server-only — and the least-privileged necessary reader chooses it, so a doc no client reads lives in `_serverData`. The scheduled sweeps' scan cursors (the Hall-media reaper's and the publicUsers reconciler's) are server-only for that reason. `__tests__/singleton-bucket-audience-guard.test.ts` fails when a doc lands in `_appConfig` or `_systemData` (a registry binding or a fixed-path builder) without a reviewed entry naming the reader that needs that audience, and fails an entry whose doc has left the bucket.
- **The Hall-media orphan reaper's cursor** (`_serverData/hallMediaReaperCursor`, `HallMediaReaperCursorSchema` in `./doc-schemas`): `createdAtCursor` is the highest Hall-owned asset `createdAt` the asset phase has moved past, and the optional `deferred` set (`HallMediaReaperDeferredCandidateSchema` — `mediaAssetId`, epoch-ms `createdAt` / `nextAttemptAt`, and an `attemptCount` of at least 1) holds the candidates it moved past without positively clearing, to be retried once due and dropped once cleared. So one uncertain candidate never pins the window. Each asset appears at most once, every entry sits at or below the cursor, and the set is bounded by `HALL_MEDIA_REAPER_MAX_DEFERRED` (`constants/scheduled-jobs`, 50): every pass retries its due entries on top of its bounded page, and a full set means something systemic is failing, so the reaper reports rather than growing it. A cursor written before the set existed has no `deferred`, which reads as empty.
- **The Hall-media orphan reaper's policy** (`constants/scheduled-jobs`, beside `HALL_MEDIA_REAPER_MAX_DEFERRED`): `HALL_MEDIA_ORPHAN_GRACE_MS` (14 days) is how long Hall-media copies are left alone before either phase may reclaim them — an asset measured from its `createdAt`, a copy intent through the `reapAfter` recording sets that far out. It must exceed the Hall publish trigger's retry window, and it leaves a parked publish time to be re-driven onto the same deterministic copy and reuse its objects. `HALL_MEDIA_REAPER_PAGE_SIZE` (100) is the most candidates each phase takes up per pass. `HALL_MEDIA_REAPER_BACKOFF_BASE_MS` (1 day, the reaper's cadence) and `HALL_MEDIA_REAPER_BACKOFF_MAX_MS` (14 days) are the one deferral backoff for both phases: with `n` the deferral count after the deferral being scheduled (`reapAttemptCount` on an intent, `attemptCount` on a deferred cursor entry), the item is next due `min(BASE × 2^(n−1), MAX)` from now — 1, 2, 4, 8, then 14 days. `HALL_MEDIA_REAPER_CLAIM_LEASE_MS` (1 hour) is how long the copy-intent sweep holds a claim: claiming moves an intent to `reaping` and stamps `reapClaimedAt`, and that stamp is the claim's fencing token. Once the claim expires, a later sweep may take the intent over and re-stamp it, and the copy path may take the `reaping` intent back to `copying`. It must far exceed the reaper function's timeout, so a live pass never loses its claim, and stay far below the Hall publish trigger's retry budget (about a day), so a publish stranded behind an abandoned claim always recovers inside it.
- **The Hall sub-item read bound** (`constants/app-mode`, root + `./constants`): `HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE`, keyed by `WorkProjectType` like the other per-kind Hall sub-item maps, is the most sub-items one Hall item can hold of each kind (chapters / tracks / episodes) in ANY app mode — each kind's count cap at its largest across `CHARTER_LIMITS` and `FULL_LIMITS`, derived from both so it never drifts. It is a read bound, never an enforced limit: a Hall item keeps what it was published with when the mode changes, so a reader that must see every sub-item (the orphan reaper's reference read) sizes its query from it and treats a read that returns more as uncertain. It is the one sanctioned cross-mode read; everything else reads `ACTIVE_LIMITS` or its alias constants, and enforcement uses the active caps.
- The mascot device-local storage keys + same-tab change-event names (in `constants/storage-keys`, alongside the other well-known keys) — companion / hidden / line-index keys and their change events, values byte-stable for backward compatibility. The **manual reduced-motion House control** lives here too (`REDUCED_MOTION_STORAGE_KEY` = `'ttt-reduced-motion'`, `REDUCED_MOTION_CHANGE_EVENT` = `'ttt-reduced-motion-change'`): device-local by design, independent of the companion store (reducing motion never hides the companion), and never mirrored to Firestore.
- The **first-visit site-tour contract** (account-durable, server-written): the `siteTour` optional structured field on `UserPrivateDataSchema` (`doc-schemas/user.ts` — `UserSiteTourStateSchema` = `{ completedVersion?, completedAt?, notTodayDate? (strict YYYY-MM-DD), automaticInvitesDisabledAt? }`); the single server-writer callable input `UpdateSiteTourPreferenceInputSchema` (`schemas/users.ts` — a `.strict()` discriminated union on `action`: `deferToday` carries a `YYYY-MM-DD` `date`, `dismissAutomaticInvites` and `completeTour` are payload-free); and the `SITE_TOUR_CURRENT_VERSION` constant (`constants/business-user.ts`, currently `1`). The tour version is server-owned — the callable stamps `SITE_TOUR_CURRENT_VERSION` at completion; the client never supplies a version. `privateData/{uid}` is the sole authority for tour eligibility.
  - The **pending-preference slot** is the ONE sanctioned browser-persisted overlay on that account-durable state, and it is not a cache, mirror, or second authority: `siteTourPendingStorageKey(uid)` + `SITE_TOUR_PENDING_CHANGE_EVENT` (`constants/storage-keys`) address a single **uid-scoped** entry validated by the strict `SiteTourPendingPreferenceSchema` (`schemas/users.ts`, beside the callable input — discriminated on the same three `action`s, carrying `schemaVersion` / `id` / `uid` / `createdAt`, plus `date` on `deferToday` and the replay-guard `tourVersion` on `completeTour`). It records a choice whose server write is unconfirmed so the overlay can close on the click and the write can be replayed later; the stored `uid` must match the key owner, the `id` is the compare-and-remove token, and a `tourVersion` that is not `SITE_TOUR_CURRENT_VERSION` is stale. Malformed data is discarded and eligibility falls back to the server — invalid storage must never hide the tour permanently.
- **Gateway download filenames**: the optional `downloadFilename` on the canonical
  `MediaAssetVariantSchema` (variant-specific — the downloadable bytes are a processed
  variant, so the extension must match THAT variant's `contentType`), carried unchanged
  through `MediaAssetSchema.variants`, `MediaServingAuthorityRecordSchema.variants`, and
  the `EdgeServingRecord`'s `EdgeServingVariant` projection; plus the ONE pure normalizer
  + RFC escaping owner in `src/media/download-filename.ts`
  (`normalizeDownloadFilename`, `buildContentDispositionFilenameForms`,
  `extensionForContentType`) and its policy constants in `constants/media-download`
  (`MAX_DOWNLOAD_FILENAME_BYTES`, `DOWNLOAD_FILENAME_FALLBACK_STEM`). Backend publishers
  normalize before writing; the media Worker re-normalizes defensively and assembles the
  header itself. Set only for surfaces that intentionally offer a Download action
  (Work Files, Conversation Files, downloadable Hall media) — absent everywhere else,
  which serves the safe bare `attachment` disposition.
- TTT upload-variable schemas
- TTT mention kinds/schemas/validation rules
- TTT admin task type union
- Work invite source schemas/types (`InviteSource`, `InviteSourceType`) for standalone, craft-skill, commission, and audition invite origins
- Work stake-share-operation schemas/types, including the invite-only pending-stake-share reservation contract
- Work guild-standing IDs, action IDs, action grants, and guild-standing-assignment policy
- Commission proposal lifecycle schemas/types (`open`, `invited`, `accepted`, `rejected`)
- The whole-app Firestore document-schema registry (`./doc-schemas` — `COLLECTION_SCHEMAS`, CI-enforced for completeness): user, work-project, content, social, payments, commissions, messaging, moderation, safety/NCII, notifications, chat-sync, and more
- User-status provenance: `FullUserSchema.statusUpdatedBy` is optional until a status first changes, then is always either the authenticated actor's uid or a stable namespaced system actor identifier (for example `system:autoHashLock`), never `null`.
- The notification type catalog and broadcast/archive schemas (`./schemas/notification` — `NotificationType`, `NOTIFICATION_TYPE_CATALOG`, broadcast/archive input schemas)
- The published Hall text-change contract: `HallContentChangeRequestSchema` is a plain, top-level-diffable document schema whose `surface` is the single authoritative discriminator and whose `proposedFields` is a FLAT field map. The strict per-surface rule — allowlist plus per-field caps, both read from the canonical `HALL_CONTENT_TEXT_FIELDS` / `HALL_CONTENT_TEXT_FIELD_MAX` owners — is the exported `validateHallContentTextFields`, which the backend calls at its boundary before persisting or applying a proposal. There is no second allowlist and no nested patch shape.
- Hall PUBLICATION requirements: the published shapes carry them as REQUIRED fields (all three covers on `PublishedHallItemSchema`; the picture plus the type's media on the published chapter/track/episode), while the working `Full*` shapes stay able to represent incomplete content. The per-work-type submit/approve/publish rule itself is one owner — `HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE` with `HALL_SUB_ITEM_REQUIREMENT_LABELS` and the pure `unmetHallSubItemRequirements` / `isHallSubItemPublishable` — so the member-side eligibility filter and all three backend cores read the same definition instead of restating the branch.
- A terminally parked Hall publish is visible on the threshold document: the optional `publishParkedReason` (bounded by `MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH`) + `publishParkedAt` on `ThresholdItemSchema`. It adds no status value — `reviewStatus` keeps its three states and the admin unwind path is unchanged.
- Closed field maps for the computed-key writers: `MODERATION_CLEARABLE_TEXT_FIELDS` (per clearable surface), `WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD` (work shell text field → its published hall-item field), and `HALL_LIBRARY_TARGET_FIELDS` (upload origin → the doc field that receives the media-asset id). Each is `as const satisfies`, and a package test proves every value is a field the target document's schema actually declares, so a writer may keep its computed-key form without escaping the registry. `HALL_LIBRARY_TARGET_FIELDS` additionally ships the two WRITE-LEVEL subsets derived from that one map — the hall-parent cover origins and the chapter/track/episode sub-item origins, with their key-union types and type guards — so a processor that owns one level indexes only the fields the document it writes declares, and an origin added to the parent map fails to build until it is classified.
- `AuditEventType` catalog, `TTTAuditActor`, `TTTAuditTarget`, and `TTTAuditEvent` specialization of the `@ttt-productions/audit-core` generic
- **Chat-edge-rebuild concrete contracts (P1):**
  - The frozen deterministic ID/`hash()` helpers in `src/ids/chat-ids.ts`
    (canonical domain-tagged SHA-256 via `edge-protocol-core`'s runtime-neutral
    `sha256Hex`; ALL async): `channelKey`/`authPairKey`, the `chatSyncEvents`
    eventIds, `chatSyncFanoutJobId`, the degraded-cause/scope keys, the inbox
    projection eventId, `notificationDeliveryId`/archive ids (the active-card id
    is NOT here — it is `notification-core`'s `buildActiveNotificationDocId`), the
    moderation audit ids, and `chatAnonymizeJobId`.
  - The new Admin-SDK-only Firestore doc-schemas: `notificationDeliveries` +
    `notificationFanoutJobs` (delivery ledger / fanout engine) and the chat-sync
    set `chatChannelAuthProjections`, `chatScopeDegraded` (+ `causes`),
    `chatSyncEvents`, `chatSyncFanoutJobs`, `chatMessageOutbox`,
    `chatAdminActionCommands` — all wired into `COLLECTIONS`, `PATH_BUILDERS`, and
    the CI-enforced `COLLECTION_SCHEMAS` registry.
  - The `chat.moderationAction{Requested,Applied,Failed}` audit types.
  - Strict `chatSyncFanoutJobs` selector arms, including the two-participant invite projection re-drive, and canonical active user/admin notification collection and document path builders.
  - Version-init fields (backend-only, with frozen ABSENT defaults): user
    `accountAccessVersion`/`accountAccessState` (absent ⇒ `{0, 'active'}`) and
    `GuildmateUser.guildAuthInputVersion` (absent ⇒ 0), plus the
    `activityGeneration`/`seenAtGeneration` opaque-token fields on the active
    notification doc.
- **Conversation Files contract** (replaced inline chat attachments): the
  `ConversationFileRef` union (`src/media/conversation-file-ref.ts` — EXACTLY
  `guildInvite` | `adminSupport`; guild chat channels are excluded by design), the
  `conversation-file` `FileOrigin` + `TTT_MEDIA_SPECS` entry and its strict
  `ConversationFileTargetInfoSchema` (the ref and nothing else — no message text,
  replyTo, message id, or isUserReply), the `ConversationFileSchema` owner record
  (`doc-schemas/messaging.ts` — references/metadata only: no status, URL, storage
  path, or identity snapshot) plus the four backend-owned quota counters on both
  conversation parents, the `conversationFiles` collection constant with
  `PATH_BUILDERS.{guildInvite,adminDispatch}ConversationFile` /
  `COLLECTION_REFS.{guildInvite,adminDispatch}ConversationFiles`, the byMode
  `ACTIVE_LIMITS.conversation` caps with the derived `MAX_CONVERSATION_FILES` /
  `MAX_CONVERSATION_FILE_STORAGE_BYTES` (`constants/conversation-files`), the
  `conversationFile` publication kind + asset owner type, and the
  `messaging.fileShare` capability. Safety locates a file the same way: the
  `conversationFile` `TargetLocatorV1` variant carries the `ConversationFileRef` +
  `conversationFileId` + `mediaAssetId` (so a guild-CHANNEL conversation file is
  structurally inexpressible), and the NCII removal `surface` enum names
  `conversationFile`. Reporting targets the FILE, not a message: the
  `conversation-file` `ReportableItemType` (label `Conversation File`, priority
  multiplier mirroring `work-asset` — the other shared-file surface) is in
  `CONTENT_ACTION_PANEL_ITEM_TYPES` and both admin content-action target sets, and
  is deliberately NOT in `CHAT_REPORT_ITEM_TYPES` (it has a Firestore owner doc, so
  it needs no signed chat-Worker context read). The removed chat-attachment surface —
  `guild-chat-message-attachment`, `messaging.attachment`, `chatAttachment` /
  `adminSupportAttachment` publication kinds, the `chatAttachment` target locator
  and NCII surface, the dead `ResolvedReportTargetV1.attachmentId` mirror, the
  `chat_derivative` media copy reason, the `guildChannel` media scope and grant
  lane, `chatAttachmentBytesUsed`, `attachmentFlip` — is gone, not aliased.
- **The founder legal-review notice** (server-safe root, `constants/legal-review-notice-state` +
  `constants/legal-review-notice`): the code-controlled switch and immutable revision id, the
  settled copy, the typed placement table whose keys are the context union, the plain-text
  helper for backend-owned copy, and the receipt builder. See § Public documents and the
  founder notice.
- **Versioned public documents** (Terms, Privacy, Rules & Agreements, Future Plans, the DMCA
  policy, Take It Down copy): the `PublicDocumentId` union, labels, acceptance claim name, and
  the re-acceptance prompt's agreement statement (`constants/public-documents`); the version,
  working-copy, release, version-block, and acceptance-summary document schemas
  (`doc-schemas/public-documents`) with their path builders; the save-draft / publish-release /
  accept / read-history callable schemas and the `publicDocuments.released` /
  `publicDocuments.accepted` audit payloads (`schemas/public-documents`); the empty seed-callable
  inputs, one per document (`schemas/utility`); and the pure versioning and comparison rules,
  including the Square agreements rule (`utils/public-documents`).
- **The `_appConfig/app` singleton at rest** (`utils/app-config`, root + `./utils`):
  `DEFAULT_APP_CONFIG`, every operator lever at its open value (maintenance off, registration
  open, no banner, no throttle, and `appVersion` `''` — no version published, so VersionGate stays
  dormant until an operator sets a real one), and `mergeAppConfigUpdate(existing, update)`, the
  one write rule: the update over the doc as read, missing fields from the default, validated
  whole against `AppConfigSchema` (it throws rather than return an invalid doc). A backend writer
  that writes its result can never leave a doc missing its required fields, even as the first
  write into a fresh or wiped environment. The release-owned version block has no default — it is
  absent until the first release.
  - **The one read rule** for the untrusted stored doc: `readAppConfigLever(snapshot, lever)` is a
    lever's stored value when its `AppConfigSchema` field accepts it, otherwise its
    `DEFAULT_APP_CONFIG` value — for a missing doc, an absent field, and a value the schema
    refuses (a console edit of the wrong type, an over-cap message, an out-of-range multiplier)
    alike, one lever at a time so a bad field never costs the good ones. `readAppConfigLevers`
    runs every lever through it (typed `AppConfigLevers`, keyed by `AppConfigLeverKey`). It never
    throws, so a config read can never take the product down by itself; the backend's snapshot
    reader and the client shell both read through it, and neither keeps a second reader.
  - **The version block's reader.** The release-owned `publicDocumentVersions` block has no
    default to fall back to, so `readPublicDocumentVersionBlock(snapshot)` reports what the
    untrusted doc holds instead of repairing it: `absent` (nothing released — its `block` is
    `undefined`, which every public-document rule reads that way), `valid` (the parsed block), or
    `invalid` (a stored block its `AppConfigSchema` field refuses, `null` included, with the
    refused field named and no block to compute from). It never throws. What an invalid block
    means is each consumer's policy, never the reader's: the one level derivation,
    `requiredPublicDocumentAcceptanceLevelOfReading`, answers `null` for it rather than a number.
  - `DEFAULT_MAINTENANCE_MESSAGE` is the one line shown while maintenance is on and the operator
    left `maintenanceMessage` blank — on the takeover screen and in the callable refusal alike.
    The stored default stays `''`: blank is what selects the line.
  - **The callable maintenance refusal** has one recognisable shape, owned beside that line: it is
    thrown with `MAINTENANCE_REFUSAL_CODE` (`unavailable`) and details typed
    `MaintenanceRefusalDetails`, whose `reason` is `MAINTENANCE_REFUSAL_REASON`.
    `isMaintenanceRefusalError` recognises it on the server-side error and the client callable
    error alike (both code spellings) by code and details, never by message text, so a real
    `unavailable` outage is never mistaken for it; `isMaintenanceRefusalDetails` is the details
    guard. The shape mirrors auth-core's structured refusals without sharing their internals.
  `AppConfigSchema` caps every text lever with the same `constants/` declaration its
  `UpdateAppConfigInputSchema` field uses (`MAX_APP_VERSION_LENGTH`,
  `MAX_MAINTENANCE_MESSAGE_LENGTH`, `MAX_ANNOUNCEMENT_MESSAGE_LENGTH`; a package test compares
  the two schemas field by field), so no writer — `mergeAppConfigUpdate` included — can store a
  value the update input would refuse. `appVersion` still accepts the unpublished `''` at rest;
  only the update input requires a non-empty version.
- **Craft-skill kind copy and launch blocks** (`constants/craft-skill-statements`): the verbatim
  agreement statements, kind labels and order, and the ONE owner of which kinds are blocked at
  launch — `CRAFT_SKILL_KIND_UNAVAILABLE_MESSAGES`, the refusal copy keyed by kind. The blocked
  set (`BLOCKED_CRAFT_SKILL_KINDS`) and the `isBlockedCraftSkillKind` predicate derive from its
  keys, so a blocked kind always has its copy. A blocked kind still renders in the picker;
  selecting it stops the flow with that copy, and the upload callable refuses it with the same
  words. Unblocking a kind is removing its entry.
- **Pledge and Bouquet copy** (`constants/pledge-and-bouquet-copy`, server-safe root): the
  settled sentences a pledge or Work surface states verbatim instead of restating them —
  `PLEDGE_BADGE_RECOGNITION_COPY` (a badge comes at a pledge total; every Charter honor is
  thank-you recognition, never something a pledge buys) and
  `BOUQUET_APPRECIATION_AND_PAYOUTS_PLANNED_COPY` (Bouquets and artisan payouts are planned, not
  built). The second is true only while the Bouquet purchasing and payout release flags are off;
  a package test fails when either flips, so the flag and the sentence change together. A surface
  that says something different — a different scope, voice, or legal wording — keeps its own
  words rather than bending a shared sentence.
- **The account Auth-effect retry queue** (`statusReconcileQueue/{uid}`, `doc-schemas/operational`):
  one entry per uid, discriminated on `authEffect` — `accountStatus` (carries its
  `targetStatus`; an entry without `authEffect` is one of these) or
  `publicDocumentsAcceptedClaim` (strict, no `targetStatus`). The drain re-converges every
  Auth-side mirror of the uid from canonical docs whichever effect queued it.

## Entry points

`ttt-core` is the application-data package and is the sanctioned exception to the "generic packages stay minimal" pattern — it exposes many subpaths beyond root. Current `exports` (see `package.json` for the authoritative list):

- `.` — core types/schemas/constants
- `./types`, `./paths`, `./utils`, `./media`, `./permissions`, `./upload-variables` — typed surfaces by concern
- `./constants`, plus `./constants/business`, `./constants/moderation`, `./constants/options`, `./constants/pagination`, `./constants/retention`, `./constants/scheduled-jobs`, `./constants/storage-keys` — constant catalogs split by domain
- `./schemas` — general TTT wire/data schemas
- `./schemas/notification` — the notification type catalog and broadcast/archive input schemas
- `./doc-schemas` — the whole-app Firestore document-schema registry (`COLLECTION_SCHEMAS`)

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

Hall-library cover and sub-item upload `targetInfo` schemas carry typed ids only. They must not accept client-provided Firestore paths or field maps. The consuming backend derives final document paths through `PATH_BUILDERS`, derives media asset fields through `HALL_LIBRARY_TARGET_FIELDS`, and validates a persisted sub-item job's origin/surface pair through `HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN` from `src/media/hall-library-target-fields.ts`.

When adding a new media origin that writes back to Firestore, add the target-info schema and any target-field mapping here first, then publish and consume it in `ttt-prod`. Do not let application code reconstruct the old `{ docPath, fields }` pattern locally.

Target-info schemas may carry user-authored domain payload, but they must not make client-supplied identity authoritative. Do not add `createdBy`, `userId`, `actorId`, owner/admin identity, or recipient identity fields to new target-info shapes unless the consuming backend derives the value from auth / `pendingMedia.userId` or verifies exact equality before persistence.

## Realm / Work discovery contract ownership

`ttt-core` owns the shared Realm/discovery launch contracts before `ttt-prod` adopts them. Do not define parallel app-only interfaces, schemas, path helpers, or business constants for these shapes.

The old nested public Work projection contract must stay removed: do not keep `WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_DATA` or `PATH_BUILDERS.workProjectPublicData(...)` as launch-era APIs. `publicWorkProjects/{workProjectId}` is the only Work shell/search projection.

Keep the detailed contract shape in source types, schemas, constants, and tests rather than in this doc. The package-level ownership rule covers Realm and public Work projection types, create/edit schemas, Mention/Square related-id contracts, PublicUser search/display requirements, hidden flags on published Hall projections, and the non-person founding-Work stake-holder contract for Works built into an existing public Realm.

A Work's standing inside its Realm is `RealmCanonStatusSchema` / `RealmCanonStatus`
(`doc-schemas/work-project`) — one declaration for both the Work shell and its public
projection, and what a consuming query filter or hook parameter types itself with instead of
re-quoting the members. It is a different concept from the realm FILE approval gate
(`RealmFileCanonStatusSchema` below), which adds the `none` / `pendingApproval` states.

Realm docs store no child Work arrays, no counts, no Realm image fields, and no denormalized owner display fields. Display identity remains uid-only across package boundaries; consuming apps resolve names/avatars from their own public identity source.

### Realm shared files — the promotion approval gate

Sharing a Work file to its Realm is a **request**, not an instant share, and `ttt-core` owns the whole contract set. Promotion still rides the single mutate-in-place seam on the file's ONE `mediaAssets` doc — there is no second status field and no Realm-owned copy of the file:

- `RealmFileCanonStatusSchema` carries the gate as a value (`none` → `pendingApproval` → `nonCanon`/`canon`), with `RealmFileApprovedStatusSchema` and `RealmFilePendingApprovalStatusSchema` as the derived subsets consumers import instead of re-quoting members. `MediaAssetSchema` gains `realmFileFolderId` plus the three `realmFileShareRequest*` fields and **enforces their legal combinations** with a refinement, so a half-written state (an approved file with no folder, a pending file already in the pool, a decline that left request metadata behind) cannot be persisted. `accessTier` is deliberately NOT constrained there — tier is origin-dependent across every media origin, so tier correctness on these transitions is callable-enforced.
- `RealmFileFolderSchema` at `workRealms/{workRealmId}/realmFileFolders/{realmFileFolderId}` (`WORK_REALM_SUBCOLLECTIONS`, `PATH_BUILDERS.realmFileFolder`, `COLLECTION_REFS.realmFileFolders`, registry-bound). Pure containers: no default folder (approval IS the folder assignment), no access lists (Realm-level visibility is the whole access model), no stored counts. `MAX_REALM_FILE_FOLDERS` bounds the collection; folder names reuse the one platform `MAX_FILE_FOLDER_NAME_LENGTH`, and the server derives `name_lowercase` for case-insensitive uniqueness.
- The callable inputs for request / withdraw / approve / decline / folder create-update-delete / folder reassignment, each carrying the client-generated stable request id so a decision always names the request it observed.
- Three server projections, deliberately separate rather than one flag-switched query: the paginated artisan gallery (`REALM_SHARED_FILES_PAGE_LIMIT`, opaque cursor, `{ files, folders, nextCursor }`) whose file rows accept only the approved standings; the steward/admin promotion queue (`REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT`) whose rows accept only the pending standing; and the file-admin-gated Work-side share-state projection (`{ states }`), whose rows accept only the ACTIVE standings and exist ONLY for files that are requested or shared — an absent row means never shared. Folder documents are returned through a projection owner, never opened to direct client reads, and the folder projection's `fileCount` is server-computed per response (the folder document itself still stores no counts) so a paged client never derives a count from whichever gallery pages it happens to hold.
- The client-minted `requestId` is bounded at the atom by `MAX_REALM_FILE_SHARE_REQUEST_ID_LENGTH` — it is client-CHOSEN and durably persisted (asset doc, audit payload, notification metadata, aggregation key), so the cap lives on the shared atom rather than on each call site.
- The two canonical notification types (share request → the steward; share resolution → the party who did not act, `metadata.resolution` distinguishing approved/declined/withdrawn), keyed on the request id as the occurrence identity, with copy that stores no name or title snapshot.
- The audit event types for request, withdrawal, approval, decline, folder-assignment change, and Realm-folder create/update/delete; and the `workFile.promoteToRealm` permission copy describing request submission rather than instant sharing.

## Upload claim + origin format policy

`StartUploadRequestSchema.clientMediaClaim` (optional — rolling compatibility; absence means
inspect-only, never MIME fallback) and the same optional field on the pendingMedia base.
`TTT_MEDIA_SPECS` accept blocks now carry the explicit enabled-format selection
(`accept.formats`); the launch policy (svg/heic/avif disabled, shared containers enabled with
inspection-derived kind) is pinned by `__tests__/media-format-policy.test.ts`.
Every file-bearing `upload-variables` schema carries an optional `claim`
(`ClientMediaClaim` from media-schemas) so hooks thread MediaInput's action
context (picker/camera/recorder) to `startUpload`; `upload-variables-claim.test.ts`
structurally asserts no file-bearing schema ships without it.

## Public documents and the founder notice

The Admin-editable public pages are versioned documents published in release bundles. The
durable rules:

- **Identity.** Each `PublicDocumentId` is also the doc id of that page's public current
  projection under `_appConfig`, so the ids derive from `SPECIAL_DOCS` and
  `PATH_BUILDERS.publicDocumentProjection(id)` names the same doc as the per-page builders. A
  document's CONTENT is its projection shape minus `version` / `lastUpdated`; the working copy,
  the immutable version, and the projection all share it. The DMCA policy has its own content
  schema (intro, labeled contact blocks, long-form sections) like the others.
- **Versions.** Whole numbers v1, v2, … per document, assigned only by the publish. "Require
  acceptance" is a property of the release, never a second version number: a requiring release
  sets each included document's required version and raises the one required-acceptance level
  by exactly one. `planPublicDocumentRelease` is the one version-assignment rule; a correction is
  a new version, never an edit. There are no direct page-update input schemas — every change is a
  saved working copy published through a release.
- **Acceptance.** The `_appConfig/app` version block is the system side (read off the untrusted
  doc only through `readPublicDocumentVersionBlock`, § The `_appConfig/app` singleton); the private
  `publicDocumentAcceptance` summary (latest accepted version per document, accepted level,
  notice revision) is the person's side, and the `docsAccepted` claim mirrors the accepted
  level for the backend gate. `changedPublicDocuments` is the one "what changed for this person"
  rule — the prompt shows exactly that list and the accept callable compares what the prompt
  showed with it, so a publish racing the prompt is detected. Registration makes the same
  comparison: `RegisterUserInput.publicDocuments` is the list the signup page showed
  (`changedPublicDocuments(block, undefined)` — empty before the first release, which is what
  keeps first-admin bootstrap working), in the one `ShownPublicDocumentVersionsSchema` shape the
  Accept input uses, and a mismatch answers `refreshRequired` and writes nothing. Both results
  share `PublicDocumentsRefreshRequiredResultSchema` as their refusal arm. The prompt's agreement line is
  `PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT`, independent of the notice. Acceptance history is
  only the append-only `publicDocuments.accepted` audit events.
- **Square agreements.** The Square card incorporates the Rules & Agreements page by reference.
  `squareStreetzAgreementsSatisfied` is the one rule the composer and every server Square post
  path apply: a recorded acceptance date AND an accepted Rules version at or above the Rules'
  latest required version (0 before any requiring Rules release). A Rules release that required
  acceptance asks again; one that did not never does. Each acceptance is audited as
  `social.squareStreetzAgreementsAccepted`, whose payload is
  `SquareStreetzAgreementsAcceptedAuditPayloadSchema` (`schemas/users`, beside the callable's
  input): the Rules version accepted and the one the record held before it (null on the first
  acceptance). Every recorded "which version was accepted" value — that payload, the private
  record's `squareStreetzAgreementsVersion`, and the Artisan upgrade's
  `artisanCreatorAgreementsVersion` — derives from `PublicDocumentVersionOrNoneSchema`
  (`doc-schemas/public-documents`: a whole number, 0 meaning none yet).
- **The notice.** `LEGAL_REVIEW_NOTICE_ACTIVE` is a code constant (like `APP_MODE`), independent
  of the app mode and of any release's acceptance choice. Copy is verbatim; a wording change
  ships under a new `LEGAL_REVIEW_NOTICE_REVISION`, and the package test pins each revision to
  its exact copy so recorded receipts keep meaning the words a person saw. Off, the plain-text
  helper returns null, no revision or receipt is recorded, and the registration Terms checkbox
  reverts to the plain agreement. Take It Down and the DMCA policy are statutory processes and
  carry no notice.
- **Charter signup** is derived (an account created before the flip); there is no stored
  `charterSignupMember` stamp.
