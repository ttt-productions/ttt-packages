# @ttt-productions/ttt-core

TTT Productions application-data package.

## Owns

- TTT-specific types, schemas, constants, paths, and business rules
- Concrete `FileOrigin` and `TTT_MEDIA_SPECS`
- Upload wire schemas, target-info schemas, `parseTargetInfo`, and server-owned hall-library upload target-field mappings
- Concrete TTT pending-media schemas composed from `media-schemas` (the optional `processingAttemptCount`/`processingLeaseExpiresAt` crash-recovery fields ride the composed strict branches)
- Media-processing crash-recovery policy constants (`constants/media-processing` → `constants` barrel): `MEDIA_PROCESSING_MAX_ATTEMPTS` (2 — first attempt + one retry) and `MEDIA_PROCESSING_LEASE_MS` (12 min)
- The TTT account-password contract: `PASSWORD_MIN_LENGTH` (7) / `PASSWORD_MAX_LENGTH` (64) in `constants/business-user`, plus the single `validateTttPassword` owner in `utils/password`. Length only — no composition rules — counted in UTF-16 code units to match HTML inputs and the Firebase SDK, never trimming or normalizing, and confirmation matching stays the caller's job. Deliberately NOT named `validatePassword`: Firebase's SDK owns that name and reads mutable hosted project policy, while this is the stable product contract every TTT password surface (registration, reset) and the hosted Firebase policy derive from.
- **Age from a date of birth** — the ONE validation and bracket derivation: `DateOfBirthSchema`
  (`schemas/users`, the bounded shape the upgrade and artisan inputs take) built on
  `DateOfBirthShapeSchema` (the same fields with no bounds — the registration age step takes it so a
  malformed date gets the same answer as an under-13 one), the floors `AGE_TEEN_FLOOR_YEARS` (13),
  `AGE_ADULT_FLOOR_YEARS` (18), and `DATE_OF_BIRTH_MIN_YEAR` (1900) in `constants/business-user`, and
  `deriveAgeBracket(dob, asOf)` / `ageInWholeYears` in `utils/age-derivation` — `invalid` for a
  non-whole part, an out-of-range month or day, an impossible calendar date, a year before the
  floor year, or a future date; `under13`; otherwise the `teen` / `adult` bracket, on the UTC
  calendar. The registration age step, the teen-to-adult upgrade, and artisan onboarding all derive
  from it; a surface that must not reveal an under-13 answer maps `under13` and `invalid` together.
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
- **Telemetry** (`constants/safety-telemetry-patterns`, `constants/telemetry-content-policy`, root + `./constants`):
  `TTT_FORBIDDEN_TELEMETRY_PATTERNS`, the TTT patterns every telemetry scrubber adds to monitoring-core's defaults, and
  `TTT_TELEMETRY_CONTENT_POLICY` — the options of monitoring-core's `createTelemetryContentPolicy`: `diagnosticKeys` (the
  descriptors capture sites set, the snake_case alarm tag keys, and the `extra` capture-context container),
  `diagnosticKeySuffixes` (`Id`, `Ids`, `Uid`, `Uids`, `Hash`, `Type`, `Kind`, `Status`, `Code`, `Outcome`, `Origin`,
  `Source`), and `codeNameContexts` (`function`). One declaration for every
  runtime that builds the policy from it, so all of them cut an event to the same allowlist (QUALITY-106); plain data, so ttt-core takes no monitoring-core
  dependency. A key that can hold prose, a stored document, a file name, or a storage or document path never joins it.
- **The life of a rejected upload.** `REJECTED_MEDIA_RETENTION_DAYS` (`constants/retention`) is both
  how long a rejected file is kept and how long its rejection can be appealed —
  `rejectedMediaAppealDeadline(rejectedAt)` / `isRejectedMediaAppealOpen(rejectedAt, now)` measure it
  from the rejection, so an appeal can only be filed while its file is kept.
  A media violation carries `mediaKind`, the kind the server inspected from the rejected bytes (the same `ContentMediaKindSchema` atom `WorkFileSchema` uses); the schema requires it on a media violation and refuses it on any other, so a preview renders by it and never by the client-declared `originalContentType`.
  `contentViolationActions(violation, now)` (`doc-schemas/moderation`) is the one rule for what a
  violation offers by `appealStatus`: `none` → Appeal (media only, inside the window) and Accept;
  `pending` → nothing (locked); `denied` → Accept only; `approved` → nothing. The UI and the server
  transaction read the same rule.
- The Company / Green Room mascot **contract + content** (`constants/company-mascots`): the pure `CompanyCharacterId` / billing-kind / `CompanyPerformanceIntent` / selectable-companion unions, roster + selectable arrays, the rich-copy `CompanyCopySegment` / `CompanyCopyBlock` model (with semantic `CompanyNavigationTarget`s, not URLs), the `COMPANY_MASCOTS` registry, and the DJ-approved verbatim studies / click lines / footers / switch exchanges / Yorick block lines / signed-out dock lines / onboarding cameos. Pure data only — no React/JSX/Next/CSS/SVG; the app owns the render adapter, puppets, rig, and choreography. Canonical dialogue lives here, never Firestore.
- The Center Stage revolving-room definitions (`constants/center-stage-rooms` — `CENTER_STAGE_ROOMS`); the app keeps `ROOM_EMBLEMS`, components, and layout
- Media **activation-job dependency fields**: the optional `parentKey` + `parentWaitStartedAt` (Firestore `Timestamp`, like the job's other time fields) on `MediaActivationJobSchema`. `parentKey` marks a job minted on an absent-parent identity lane — a curated-audition ENTRY publication whose parent audition doc is created by the PROMPT's publish — so a parent-absent publication can be parked instead of burning the retry budget, and so the prompt's publish can wake its parked siblings. `parentWaitStartedAt` stamps the first parent-absent occurrence and never moves forward. Both optional: rows predating them still parse. The park interval and wait cap are app-side runner policy, not package constants.
- **Media write intents** (`./doc-schemas` — `MediaCopyIntentSchema`, its two branches `MediaAssetCopyIntentSchema` / `MediaIngestIntentSchema`, `MediaCopyIntentKindSchema`, `MediaCopyIntentStateSchema`): the server-only record of one media write in flight at `mediaCopyIntents/{newAssetId}` (`COLLECTIONS.MEDIA_COPY_INTENTS`, `PATH_BUILDERS.mediaCopyIntent`, `COLLECTION_REFS.mediaCopyIntents`, registry-bound), keyed by the asset id the write fills. A write puts its variant objects under that asset id before its asset doc exists; the intent is recorded before the first object is written and cleared in the transaction that creates that asset doc, so an intent that outlives its write names exactly the objects to reclaim. The required `kind` says which write: `copy` — a cross-owner copy, carrying the source asset id, the new owner (`ownerType` from `MediaAssetOwnerTypeSchema`), and the variant NAMES copied (canonical `MediaVariantKey`s, at least one and each at most once — object keys derive from an asset id and a variant, never stored); its objects are removed only through the object store's provenance-checked copy delete. `ingest` — the first ingest of an upload, carrying the `pendingMediaId` it ingests (the asset's future root-ingest id, which is all the reap's safety-hold check needs) and no variant list: every key the pipeline can write is a canonical `MediaVariantKey` (`MEDIA_VARIANT_KEYS` takes its video and audio members — the transcoded `main` and the video's `poster` frame — from the pipeline's own output-key declarations in media-schemas, `TIMED_MEDIA_MAIN_OUTPUT_KEY` / `VIDEO_POSTER_OUTPUT_KEY`, never restated), so the intent covers every canonical variant key under the asset id and its reap deletes each one (a key never written is already absent). Both carry a `state` of `copying` (the write may still complete) or `reaping`, epoch-ms `createdAt` / `updatedAt`, and `reapClaimedAt`, present exactly when the intent is `reaping`. The sweep schedule rides on the intent: `reapAfter` (epoch ms, required) is the earliest time the sweep may take it up, and the sweep lists due intents ordered by it — recording sets it a grace period out, and a deferral pushes it out again, so an intent that cannot finish yet (a held or unreadable source, a failing delete) rotates behind the ones that can instead of holding the head of every page. It is never earlier than `updatedAt`, so a re-recorded intent must move it too. `reapAttemptCount` (required, starts at 0) counts the times the sweep took the intent up and deferred it, which is what its backoff grows from. The grace and the backoff are the reaper policy constants below, not schema. It has no native-TTL field: an intent removed before its objects are reclaimed strands them.
- **The one media retirement** (`./doc-schemas` — `MediaAssetRetirementSchema`, `MediaAssetRetirementDeferralSchema`, `mediaAssetRetirementStanding`, `servingStatusOnRetirementRequest`, `servingStatusOnRetirementComplete`): the retirement obligation of an asset whose owner record is gone, stored as `retirement` on the asset's own `mediaAssets` doc — no new collection. The delete (or refusal) that leaves an asset unowned co-writes it in the same transaction or batch, together with the durable authority deny when the asset is still servable, so no path deletes a record and then retires its media best-effort. `servingStatusOnRetirementRequest` is that deny (`servable` → `hidden`; `hidden`, `quarantined`, and `deleted` keep their status) and `servingStatusOnRetirementComplete` is the status written with `retired` (`deleted`, but a quarantine stays `quarantined`), so a retirement never downgrades a quarantine or reopens a deleted asset. It carries `requestedAt`, `pendingVariantKeys` (the asset's variant keys whose object delete has not yet succeeded — an already-absent object counts as deleted; each once, each a key of `variants`), and the drain's retry ledger: `attemptCount`, `nextAttemptAt` (the one scheduled drain lists due obligations in this order, so a deferred one rotates behind the ones that can finish), `lastDeferral` (`held` — a legal or safety hold blocks the byte removal; `failed` — an edge step or an object delete failed), and `lastError`, present only for a failure. `MediaAssetSchema` refuses an asset that owes retirement and is still `servable`, or is already `retired`: the asset becomes `retired` only when no variant delete is owed, and the drain deletes the obligation in that same write. `mediaAssetRetirementStanding(asset)` is the one reading of the state — `absent` (no doc), `retired`, `owed`, or `none` — for a caller that may delete a record naming media only once its media is gone. The drain's backoff and page size are the app's schedule policy; the package adds no number.
- **Singleton audience buckets** (BACKEND-108): a singleton's bucket is its read grant — `_appConfig` public, `_systemData` signed-in, `_serverData` server-only — and the least-privileged necessary reader chooses it, so a doc no client reads lives in `_serverData`. `__tests__/singleton-bucket-audience-guard.test.ts` fails when a doc lands in `_appConfig` or `_systemData` (a registry binding or a fixed-path builder) without a reviewed entry naming the reader that needs that audience, and fails an entry whose doc has left the bucket.
- **The Hall-media orphan reaper's asset-phase position** lives in `sweepState/hallMediaReaperAssetPhase` (the sweep-state bullet below): its `rollingCursor` orders Hall-owned assets by `createdAt` with the asset id as the key, and its `deferred` rows are the candidates it moved past without positively clearing — retried once due and dropped once cleared, so one uncertain candidate never pins the window. The set is bounded by `SWEEP_STATE_MAX_DEFERRED` (`constants/scheduled-jobs`, 50): every pass retries its due entries on top of its bounded page, and a full set means something systemic is failing, so the reaper reports rather than growing it.
- **The Hall-media orphan reaper's policy** (`constants/scheduled-jobs`, beside `SWEEP_STATE_MAX_DEFERRED`): `HALL_MEDIA_ORPHAN_GRACE_MS` (14 days) is how long Hall-media copies are left alone before either phase may reclaim them — an asset measured from its `createdAt`, a copy's or a first ingest's write intent through the `reapAfter` recording sets that far out. It must exceed the Hall publish trigger's retry window, and it leaves a parked publish time to be re-driven onto the same deterministic copy and reuse its objects. `HALL_MEDIA_REAPER_PAGE_SIZE` (100) is the most candidates each phase takes up per pass. `HALL_MEDIA_REAPER_BACKOFF_BASE_MS` (1 day, the reaper's cadence) and `HALL_MEDIA_REAPER_BACKOFF_MAX_MS` (14 days) are the one deferral backoff for both phases: with `n` the deferral count after the deferral being scheduled (`reapAttemptCount` on an intent, `attemptCount` on a deferred cursor entry), the item is next due `min(BASE × 2^(n−1), MAX)` from now — 1, 2, 4, 8, then 14 days. `HALL_MEDIA_REAPER_CLAIM_LEASE_MS` (1 hour) is how long the copy-intent sweep holds a claim: claiming moves an intent to `reaping` and stamps `reapClaimedAt`, and that stamp is the claim's fencing token. Once the claim expires, a later sweep may take the intent over and re-stamp it, and the copy path may take the `reaping` intent back to `copying`. It must far exceed the reaper function's timeout, so a live pass never loses its claim, and stay far below the Hall publish trigger's retry budget (about a day), so a publish stranded behind an abandoned claim always recovers inside it.
- **Sweep-state docs and the one rolling cursor** (`doc-schemas/backend-state`, `doc-schemas/sweep-cursor`, `constants/scheduled-jobs`): `sweepState/{sweepName}` holds one scheduled pass's durable cadence or cursor state, one doc per name in `SWEEP_STATE_NAMES` (`SweepStateNameSchema`; `PATH_BUILDERS.sweepState` takes only those names — the Storage-listing sweeps, the media reconcile passes, the NCII retention sweeps, the safety needs-work backstops and stranded-processing sweeps, the publicUsers reconciler, the privateData reaper, the Hall-media reaper's asset phase, the refund-approval reconciler, and the possible-minor crossover reconcile — one name per leg query, `crossoverServingDenyReconcile` and `crossoverPhotoDnaReconcile`), so no two passes share a cursor. `SweepStateSchema.rollingCursor` (`SweepRollingCursorSchema`, declared in its own `doc-schemas/sweep-cursor` module because the child-safety case embeds it too) is the one cursor shape for a pass over a bounded, ordered source — a Storage listing, a Firestore query, or a case's item registration. Absent, no lap has run and the next pass starts at the beginning. `inLap` resumes strictly after `afterKey` — the last object name a Storage listing moved past (a listing page token is opaque, so it is never stored) the last document id of a query, or the full document path of a collection-group query — with `afterValue` carrying that row's value of the numeric field a query orders by first. A value is never a position by itself: rows can share it, so a query orders by the field and then by the key and resumes with `startAfter(afterValue, afterKey)`, never `field > afterValue`, which would skip every row tied with the last one on every lap. `done` records that the last lap reached the end of its source (`lapCompletedAt` no earlier than `lapStartedAt`): the pass that exhausted the source stops there instead of rereading page one, and the next pass wraps into a new lap, so rows added behind the cursor, or that became eligible after it passed them, are reached on the next lap. A finished lap's `lapCompletedAt` is also the cadence stamp of a pass that runs a lap at a time. `SweepStateSchema.deferred` (`SweepDeferredRowSchema` — `key`, optional `value`, epoch-ms `nextAttemptAt`, `attemptCount` of at least 1; each key once, at most `SWEEP_STATE_MAX_DEFERRED`) holds the rows a pass moved past without positively clearing, retried once due, so one uncertain row never pins the window. `fullScanLastRunAt` stays the cadence of the weekly `listUsers()` scan.
- **The Hall sub-item read bound** (`constants/app-mode`, root + `./constants`): `HALL_SUB_ITEM_READ_BOUND_BY_WORK_TYPE`, keyed by `WorkProjectType` like the other per-kind Hall sub-item maps, is the most sub-items one Hall item can hold of each kind (chapters / tracks / episodes) in ANY app mode — each kind's count cap at its largest across `CHARTER_LIMITS` and `FULL_LIMITS`, derived from both so it never drifts. It is a read bound, never an enforced limit: a Hall item keeps what it was published with when the mode changes, so a reader that must see every sub-item (the orphan reaper's reference read) sizes its query from it and treats a read that returns more as uncertain. It is the one sanctioned cross-mode read; everything else reads `ACTIVE_LIMITS` or its alias constants, and enforcement uses the active caps.
- The mascot device-local storage keys + same-tab change-event names (in `constants/storage-keys`, alongside the other well-known keys) — companion / hidden / line-index keys and their change events, values byte-stable for backward compatibility. The **manual reduced-motion House control** lives here too (`REDUCED_MOTION_STORAGE_KEY` = `'ttt-reduced-motion'`, `REDUCED_MOTION_CHANGE_EVENT` = `'ttt-reduced-motion-change'`): device-local by design, independent of the companion store (reducing motion never hides the companion), and never mirrored to Firestore.
- The **first-visit site-tour contract** (account-durable, server-written): the `siteTour` optional structured field on `UserPrivateDataSchema` (`doc-schemas/user.ts` — `UserSiteTourStateSchema` = `{ completedVersion?, completedAt?, notTodayDate? (strict YYYY-MM-DD), automaticInvitesDisabledAt? }`); the single server-writer callable input `UpdateSiteTourPreferenceInputSchema` (`schemas/users.ts` — a `.strict()` discriminated union on `action`: `deferToday` carries a `YYYY-MM-DD` `date`, `dismissAutomaticInvites` and `completeTour` are payload-free); and the `SITE_TOUR_CURRENT_VERSION` constant (`constants/business-user.ts`, currently `1`). The tour version is server-owned — the callable stamps `SITE_TOUR_CURRENT_VERSION` at completion; the client never supplies a version. `privateData/{uid}` is the sole authority for tour eligibility.
  - The **pending-preference slot** is the ONE sanctioned browser-persisted overlay on that account-durable state, and it is not a cache, mirror, or second authority: `siteTourPendingStorageKey(uid)` + `SITE_TOUR_PENDING_CHANGE_EVENT` (`constants/storage-keys`) address a single **uid-scoped** entry validated by the strict `SiteTourPendingPreferenceSchema` (`schemas/users.ts`, beside the callable input — discriminated on the same three `action`s, carrying `schemaVersion` / `id` / `uid` / `createdAt`, plus `date` on `deferToday` and the replay-guard `tourVersion` on `completeTour`). It records a choice whose server write is unconfirmed so the overlay can close on the click and the write can be replayed later; the stored `uid` must match the key owner, the `id` is the compare-and-remove token, and a `tourVersion` that is not `SITE_TOUR_CURRENT_VERSION` is stale. Malformed data is discarded and eligibility falls back to the server — invalid storage must never hide the tour permanently.
- **Work files render by their inspected kind** (`doc-schemas/work-project` — `WorkFileSchema`): every Work file record carries a REQUIRED `mediaKind` (the same `ContentMediaKindSchema` atom `ConversationFileSchema.mediaKind` uses), the kind the server inspected from the bytes. Its `contentType` is the client-declared MIME — possibly the neutral `application/octet-stream` — so it never decides how a file renders (MEDIA-101). A record without `mediaKind` fails the parse; there is no fallback to the declared type.
- **Short links** (`ShortLinkTargetTypeSchema` in `schemas/atoms`, `CreateShortLinkInputSchema` in `schemas/utility`,
  `ShortLinkSchema` in `doc-schemas/operational`): one target set — an audition, one audition entry, a commission listing,
  or a whole Hall entry (`hall-library-item`, created from its `hallItemId`; never one chapter, track, or episode, and
  never a Realm) — that the create input's members and the stored link's `type` both derive from. A stored link's
  `metadata` names the id of each target kind, `null` where it does not apply. A short link is never deleted: there is
  no delete input and no deletion audit type.
- **A Work's default file folder** (`utils/work-file-folder`, root + `./utils`): `DEFAULT_WORK_FILE_FOLDER_ID` is the one
  fixed folder id every Work has, and `buildDefaultWorkFileFolder(workProjectId, createdByUid, now)` builds its document
  — the folder named `DEFAULT_WORK_FILE_FOLDER_NAME` ("All Guildmates", the one declaration any copy naming it reads), open to every active guildmate with no trade-profession gating, empty at creation.
  The Work's creator and the e2e seed both build it here, so a seeded Work holds the folder a real one does.
- **The media edge-serving contract** (`media/edge-serving-contract`, root): the wire contracts the Cloud Functions side and the media Worker share, declared once so neither tree restates them (ARCH-005: the TTT-specific cross-tree shapes live in ttt-core, which both trees install; the generic mechanisms live in edge-protocol-core). `MEDIA_AUTHORITY_APPLY_PATH` is the signed internal apply route, and `MEDIA_AUTHORITY_APPLY_MAX_BODY_BYTES` (64 KiB) is the most the apply endpoint reads before it verifies the signature — a real envelope (one serving record plus its required-variant list) is a few KiB, and a package test builds the largest one the canonical limits allow and proves it fits with wide headroom. `MediaAuthorityApplyRequestSchema` (`MediaAuthorityApplyRequest`) is the one signed apply body — the serving record plus the variant keys the Worker must find in the object store: on any record only its own variant keys, each once, and on a `servable` record every one of them — so the Functions client builds it and the Worker parses it after verifying the signature. `EdgeServingRecord` is the edge projection of the serving record. `MediaSessionTokenPayloadSchema` (`SessionTokenPayload` is its type) is the one media-session cookie payload (`v: 1`, `typ: 'session'`, `uid`, the `art` / `adm` bits, `iat`, `exp`), so the Next media-session route types what it signs and the Worker validates what it verified with the same schema. `MediaGrantScopeSchema` is the ONE definition of a signed grant's scope: exactly one kind per grant — `w` (a Work's `workProject`-scoped media), `t`+`o` (one exact owner of an unscoped record, `t` a canonical owner type), `wf` (one file folder), `gi` (one guild-invite conversation), `as` (one admin-support thread), `ar` (the admin review reveal: one asset, the only scope that may reveal a hidden asset), and `rp` (a Realm steward's preview of one file awaiting their promotion decision: one asset, never revealing a hidden, quarantined, or deleted file) — and `MediaGrantTokenPayloadSchema` is the whole grant payload (`GrantTokenPayload` is its type), so the Functions signer types what it signs and the Worker validates what it verified with the same schema. The browser-cache policy is one table by access tier, `MEDIA_BROWSER_CACHE_CONTROL_BY_ACCESS_TIER`: broad media `private, max-age=900` (`MEDIA_BROAD_BROWSER_MAX_AGE_SEC`), every other tier `MEDIA_BROWSER_NO_STORE` (`private, no-store`) — scoped and adminOnly are typed so they can never hold a max-age, and artisan (Realm shared files) is no-store too. `mediaBrowserCacheControl({ accessTier, ownerType, servedUnderGrant })` is the one call for a response: no-store for anything served under a grant (the admin reveal included) or for safety evidence, otherwise the tier's entry. An entry may be added or tightened later, each with its reason written beside the table.
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
- **The Square post mention grammar** (`media/atoms`, root + `./media`): a post's text carries one placeholder token
  where each mention sits, and its `mentions` list says what each placeholder names. A placeholder is `@m` followed by a
  positive whole number (`MentionPlaceholderSchema`, at most `MAX_MENTION_PLACEHOLDER_LENGTH`; the composer builds it with
  `buildMentionPlaceholder(counter)`). In text a run of `@m` and digits is one token, read whole, and a mention only when
  the whole run is a listed placeholder — `@m1` is never found inside `@m10`. `tokenizeMentionContent` splits text into
  text and mention segments for the post card; `validateMentionCorrespondence` (and its `superRefine` form
  `refineMentionCorrespondence`) requires every listed placeholder to appear exactly once. `SquareStreetzPostMentionsSchema`
  (`SquareStreetzPostMentionSchema` items, at most `MAX_MENTIONS`, each placeholder once) is the one post mention list: the
  text-post input and the post upload variables refine correspondence on it, and the upload target info carries it while
  `startUpload` checks it against the caption, which travels outside the target info. The stored post (`SquareStreetzPostSchema`, the
  final writer's parse) holds the same list and the same correspondence with its `content`, so every enforcement point accepts
  the same values; the announcement transport (`SquareStreetzPostPayloadSchema`) types its items as post mentions and leaves the
  correspondence to that delivery-time parse. The general `MentionSchema` stays
  open to any placeholder string (a mention-history entry is not post text). `RELATED_ID_PREFIXES` (`paths/related-ids`)
  has a prefix for every `MentionType`, so a post can relate everything it mentions through `buildRelatedId`.
- TTT admin task type union, and who resolves each type (`ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE` in
  `constants/business-admin`, exhaustive over the union): the generic queue check-in (`checkin`) or
  the domain decision that closes and deletes the task. `isAdminTaskResolvedByCheckin(taskType)` is
  the one predicate — false for a decision-bearing type and for an unknown stored string — that
  report-core's check-in callback and the task cards read.
- The admin queue snapshot (`OpsStatus`, `types/admin-ops`): `adminQueue` counts unclaimed
  (`pending`) tasks per lane, change requests included, and every lane is required.
- Work invite source schemas/types (`InviteSource`, `InviteSourceType`) for standalone, craft-skill, commission, and audition invite origins
- Work stake-share-operation schemas/types, including the invite-only pending-stake-share reservation contract
- Work guild-standing IDs, action IDs, action grants, and guild-standing-assignment policy
- Commission proposal lifecycle schemas/types (`open`, `invited`, `accepted`, `rejected`)
- The whole-app Firestore document-schema registry (`./doc-schemas` — `COLLECTION_SCHEMAS`, CI-enforced for completeness): user, work-project, content, social, payments, commissions, messaging, moderation, safety/NCII, notifications, chat-sync, and more
- **The one hide mechanism's records** (`doc-schemas/moderation`, `./doc-schemas`). Every report and
  Admin Tool hide or restore is a `moderationCascadeManifests/{cascadeId}` decision: `action` is
  `hide` or `restore`, `entityType` is one of `MODERATION_HIDE_TARGET_TYPES` (the report vocabulary's
  hideable types — a `username` report and the chat-message kinds are never hidden), with
  `entityId`, `parentEntityId` exactly for the `MODERATION_PARENT_KEYED_TARGET_TYPES` (an audition
  entry, a commission proposal, a Hall sub-item, a craft skill — ids unique only under a parent;
  every other target is keyed by its id alone), `targetKey` (`moderationTargetKey`: the type, parent,
  and id, each length-prefixed, so one target has one key and no two targets share one, whatever
  their ids contain; it throws for a missing or unexpected parent), and `decision` — the target's
  decision number: each hide or restore of one target takes the next number, and
  `moderationCascadeManifestId(targetKey, decision)` makes the doc id deterministic so two decisions
  racing for one number conflict. The schema refuses a manifest whose `targetKey` or `cascadeId` is
  not derived from its target and decision. `status` stays `pending`
  until every page and edge step lands; `attemptCount` / `nextAttemptAt` / `lastError` are the
  resume's retry ledger. A hide records each document it changes as a `changedDocs` row before the
  change (Square posts, auditions and entries, commission listings and proposals, craft skills and
  their tag mirrors, and the Work / Realm / Hall / media kinds), carrying the edge
  block it wrote (`edgeSyncOwnerType` / `edgeSyncOwnerId`, e.g. an audition entry's own owner key,
  and `edgeSyncAssetIds`) so the restore clears exactly that. Every hideable document also carries
  the one provenance stamp `ModerationHiddenBySchema` (`direct` on the target, `cascade` on a child
  its parent's hide reached): `hiddenBy` beside `hidden`, `publicWorkHiddenBy` beside
  `publicWorkHidden`, `realmHiddenBy` beside `realmHidden`; a media-only target's provenance is its
  manifest record. The per-document edge obligations (a report group's, a published sub-item's)
  record the decision they belong to as `edgeSyncDecision`.
- **The safety console's paged reads** (`schemas/safety`, `./schemas`). `GetSafetyCaseConsoleInputSchema`
  carries one cursor per source plus `exhaustedSources` (`SafetyCaseConsoleSource`: `childSafety`,
  `ncii`, `takeItDown`) — a source whose last page the console holds is skipped, never restarted at
  page one. The Retention tab's list of closed child-safety cases whose evidence is still preserved
  is its own read: `ListRetainedChildSafetyCasesInputSchema` (a `createdAt` cursor or an exact case
  id, the page cap shared with the retained-evidence inventory), rows of
  `RetainedChildSafetyCaseRowSchema` (the case's list projection plus its own
  `SafetyEvidenceJobSummary` jobs), and `ListRetainedChildSafetyCasesResultSchema`. A case is
  retained while closed (`operationallyResolved`) with a preservation status in
  `CHILD_SAFETY_RETAINED_PRESERVATION_STATUSES` (every status but `destroyed`). Both trees read the
  console's answer as `GetSafetyCaseConsoleResultSchema` (the child-safety, NCII, and take-it-down
  rows, `SafetyCaseFailedJobRef`, per-source `SafetyCaseConsolePageInfo`, and the urgent projection by
  `SafetyCaseLane`) and the retained-evidence inventory's as `ListRetainedEvidenceInventoryResultSchema`.
  `SafetyCaseLaneSchema` (`csam | ncii`) is declared once beside the case shapes
  (`doc-schemas/safety/case`) and every case input takes it. The closed-case lookup answers
  `SafetyCaseByIdResultSchema` (beside `GetSafetyCaseByIdInputSchema`): discriminated by `caseType` (the
  `SafetyCaseLaneSchema` members), a child-safety case carries its `ChildSafetyWorkStatus` and an NCII case its
  `NciiInternalStatus`, with the revision a reopen names, the safe metadata typed by its canonical unions, and the
  closure history — each close as the `SafetyCaseClosureV1Schema` record it wrote plus the id of the event that
  recorded it, so its outcome is a closure outcome (`founded` / `unfounded`) with its summary. Strict, so no evidence or
  reporter field rides it. Which statuses are still open work is one declaration (`constants/safety-active-statuses`, root + `./constants`):
  `CHILD_SAFETY_ACTIVE_WORK_STATUSES`, `NCII_ACTIVE_INTERNAL_STATUSES`, and `TAKE_IT_DOWN_ACTIVE_PUBLIC_STATUSES`, each
  derived from a map that classifies every member of its union (a new status does not build until it is placed), and
  `isActiveSafetyCaseStatus({ caseType, status })`. A case stays active until its worker verifies a terminal status —
  `processing` and `failed` are open work — so the console's lists, the ops Legal-Clocks counts, and the lookup's
  reopen check read the same sets.
- **The possible-minor crossover's per-asset state** (`doc-schemas/safety/case`): a possible-minor assessment acts on every asset an NCII case links, so each asset has its own row, `childSafetyCases/{caseId}/childSafetyCaseCrossoverItems/{mediaAssetId}` (`ChildSafetyCrossoverItemV1Schema`, `PATH_BUILDERS.childSafetyCaseCrossoverItem` / `childSafetyCaseCrossoverItems`, registry-bound, retained by an erasure). A row carries a required `servingDeny` leg status, an optional `photoDna` leg status (absent when the asset has no origin lineage to scan), and each leg's stamps: `servingDeniedAt` / `photoDnaScannedAt` exactly when the leg is `done`, `…FailedAt` whenever it `failed` (it may remain after a later success), and `…LastError`, an error name only. `ChildSafetyCaseV1.crossoverLegs` is the case-level rollup of those rows — `servingDeny` and `photoDna` statuses and `itemsCursor`, the shared `SweepRollingCursorSchema` recording how far the case's items are registered across bounded transactions (absent before the first page, `inLap` while more remain, `done` once every item is registered; `isCrossoverItemRegistrationDone` reads it) — and `rollupCrossoverLegStatus(statuses, itemsCursor)` is its one rule: any `failed` → `failed`; else, while registration is unfinished, `pending` (the unregistered items still owe the leg); else any `pending` → `pending`, else `done`, none → absent. The schema holds the same line: until registration is `done`, each leg is `pending` or `failed`, never `done` or absent, so a stalled registration never reads finished. A scheduled pass finds a case with outstanding work by the rollup, resumes registration from `itemsCursor`, and lists that case's rows. Evidence capture needs no extra contract: a capture job and its manifest are keyed by the case and a free-form source discriminator, so each asset is captured under its own.
- **The take-it-down intake body** (`schemas/ncii`): `TakeItDownIntakeBodySchema` is the one strict body the no-login intake route parses — a url-only locator (`PublicTakeItDownLocatorSchema`), the electronic signature and authorized-representative blocks, the certifications, the rule that at least one contact method is present, and the rule that the authorized-representative block is present exactly when the requester is an authorized representative — so the form and the route parse one constraint set and the route adds none after the parse. Its bounds and the in-app request's are the same named constants (`MAX_NCII_LOCATOR_URL_LENGTH`, `NCII_IDEMPOTENCY_KEY_MIN_LENGTH` / `_MAX_LENGTH`, `MAX_NCII_CONTACT_EMAIL_LENGTH`, `NCII_CONTACT_PHONE_MIN_LENGTH` / `_MAX_LENGTH`), so the two intakes cannot drift on a shared field.
- **Document-id segments** (`schemas/atoms`): `documentIdSegmentSchema` is one Firestore document-id segment — non-empty, no `/`, not `.` or `..`, not the reserved `__name__` form, within `FIRESTORE_DOCUMENT_ID_MAX_BYTES` (Firestore's own limit, in UTF-8 bytes). Every `*IdSchema` atom derives from it, and so does every id a client sends that a backend builds a path from: callable inputs, upload target info and upload variables, inline fields included (a field reuses its entity's atom, or `documentIdSegmentSchema` itself when the id names no shared entity). `__tests__/document-id-segment-guard.test.ts` fails an exported `*IdSchema` that admits a value which is not one segment, and walks every exported wire input (`…Input`, `…Request`, `…TargetInfo`, `…Variables`, `…Body` schemas) so an id-named field (`…Id`, `…Ids`, `…Uid`, `id`, `uid`) that admits such a value fails too — outside a short reviewed list of ids that are never a path segment (content item keys, hashed idempotency keys, external report numbers), each with its reason. A signed media grant's ids are segments the same way. The ids a report names are hints the server re-derives: `reportTargetItemIdSchema` and `reportTargetUserIdSchema` are segments bounded by `MAX_REPORT_TARGET_ID_LENGTH`, and `reportTargetParentRefSchema` is a reference of one id or two joined by `/` (a chat channel is `workProjectId/guildChatChannelId`, a conversation file `<kind>/<scopeId>`). `SubmitReportInputSchema` (`schemas/safety`) is the submit-report callable's strict input built from them; the follow inputs' `targetId` is a segment.
- **Admin standing** (`utils/admin-standing`, root + `./utils`): `adminRosterOf` reads the untrusted `_systemData/adminList` data into an `AdminList` (an absent doc, a non-array list, and non-string entries read as empty), `adminStandingOf(roster, uid)` answers `'admin'`, `'jrAdmin'`, or `'none'` (a uid on both lists is the full admin), and `holdsAdminStanding` is true for either role. Standing is roster membership; whether a role currently authorizes anything is the backend's authority check. It is the one reading of standing: a surface that asks whether an account holds admin standing derives from it rather than restating the membership test.
- **The registration age-step rate limit** (`ACTIVE_LIMITS.rateLimits.AGE_ATTEST`, per hashed client
  IP): 30 an hour in charter mode, 75 in full — one call per attempt, sized to let one IP register
  as many people per hour as the display-name check does.
- **The Hall-preference and refund-decision rate limits** (`ACTIVE_LIMITS.rateLimits`): `HALL_PREFERENCE`
  is the one bucket a member's own Hall preference writes charge (settings, ink marks, hidden Works,
  reading position, recently viewed) — 120 an hour in both modes, the size of the other passive
  per-member write; `REFUND_DECISION` is the bucket an admin's refund approve or deny charges — 30 an
  hour in both modes, like the appeal review it sits beside.
- **Report-group close-out marker** (`doc-schemas/safety/report`): `ReportGroupV1.pendingRootTerminalization`
  is true, co-committed with a resolve (or with a closing safety case for the ordinary reports it
  owned), until every ordinary report root and projection of the group is terminal and its reporter
  feedback sent; the group's `resolutionOutcome` is the outcome it applies.
- **The account-erasure fate of every registered path** (`doc-schemas/erasure-fates`, `./doc-schemas`):
  `ERASURE_FATES_BY_COLLECTION_PATH` is total over `COLLECTION_SCHEMAS` — a new path does not build
  until it declares what erasing a member does to its documents: `delete`, `anonymize` (kept, the
  member's identity rewritten in place), `retain` (kept; a uid in it renders as Former Member), or
  `none` (nothing there names a member). A path with two fates splits by the per-document rule
  stated at its entry — a solo unpublished draft Work is deleted and any other Work retained; an
  ordinary report's reporter is anonymized and a protected-case report retained; a support thread
  follows `adminDispatchErasureFate(thread, erasedUid)` (only the member's OWN user-party thread —
  one they started as its user — is deleted with its messages and files; one the admin team started
  to them, a Work thread they started, and another member's thread they took part in are kept with
  them shown as Former Member); a rejected upload's `pendingMedia` row is deleted with its violation
  and every other row blanked; a shared feedback suggestion loses the member from its submitter
  list; a file the member uploaded in an invite conversation is deleted, the other party's kept;
  every notification sent to the member is deleted, while another recipient's naming them as actor
  is kept until it expires; an admin's `operatorStepUp` record is deleted; Hall change requests and
  refund requests are kept, the member an account id. Kept for another party, the money trail, or
  compliance: invite records, reports others filed about the member (with their evidence snapshot),
  short links, the provider-reference, ledger-event, and quarantine payment records (as long as the
  pledge ledger), the erasure's own request record (permanently), and routine upload provenance for
  its 90-day window. So nothing acts for the erased account afterwards: the member's
  announcement jobs, unapplied opening messages, and chat membership projections (last) are
  deleted, an in-flight upload is made terminal so its activation job aborts, an erased admin
  leaves the roster, and the account-status queue entry drains itself. `collectionPathsWithErasureFate(fate)` lists the paths an
  erasure must act on. The scrub's safety-hold carve-out overrides every destructive fate.
- User-status provenance: `FullUserSchema.statusUpdatedBy` is optional until a status first changes, then is always either the authenticated actor's uid or a stable namespaced system actor identifier (for example `system:autoHashLock`), never `null`.
- The notification type catalog and broadcast/archive schemas (`./schemas/notification` — `NotificationType`, `NOTIFICATION_TYPE_CATALOG`, broadcast/archive input schemas), and the Ops Repairs contracts for a dead-lettered fanout job: `DeadLetteredFanoutJobRowSchema` (job id, type, `priority` as the job stores it — `NotificationFanoutPrioritySchema`, 0, 1, or 2 — park time, last error, age), `ListDeadLetteredFanoutJobsResultSchema`, and `ResumeFanoutJobResultSchema`, beside `ResumeFanoutJobInputSchema`. Each type's `metadata` shape is `NotificationMetadataByTypeSchema`, ids only — a `guild_invite` carries the Work and invite ids and the card resolves the Work's title when it renders — and `validateNotificationMetadata(type, metadata)` is the one check of a reliable-lane row's or fanout job's metadata against its type (metadata never carries the `type` key itself)
- The published Hall text-change contract: `HallContentChangeRequestSchema` is a plain, top-level-diffable document schema whose `surface` is the single authoritative discriminator and whose `proposedFields` is a FLAT field map. The strict per-surface rule — allowlist plus per-field caps, both read from the canonical `HALL_CONTENT_TEXT_FIELDS` / `HALL_CONTENT_TEXT_FIELD_MAX` owners — is the exported `validateHallContentTextFields`, which the backend calls at its boundary before persisting or applying a proposal. There is no second allowlist and no nested patch shape.
- Hall PUBLICATION requirements: the published shapes carry them as REQUIRED fields (all three covers on `PublishedHallItemSchema`; the picture plus the type's media on the published chapter/track/episode), while the working `Full*` shapes stay able to represent incomplete content. The per-work-type submit/approve/publish rule itself is one owner — `HALL_SUB_ITEM_REQUIRED_FIELDS_BY_WORK_TYPE` with `HALL_SUB_ITEM_REQUIREMENT_LABELS` and the pure `unmetHallSubItemRequirements` / `isHallSubItemPublishable` — so the member-side eligibility filter and all three backend cores read the same definition instead of restating the branch. The sub-item LOCK is one owner beside it (`utils/hall-content`): `HALL_SUB_ITEM_LOCKED_STATUSES` (`pending_approval`, `published` — typed against the chapter / track / episode `status` field, exported as `HallSubItemStatus`) and the pure `isHallSubItemLocked(status)`, true exactly for those two, so the backend lock checks and the editors decide from one definition.
- A terminally parked Hall publish is visible on the threshold document: the optional `publishParkedReason` (bounded by `MAX_THRESHOLD_PUBLISH_PARKED_REASON_LENGTH`) + `publishParkedAt` on `ThresholdItemSchema`. It adds no status value — `reviewStatus` keeps its three states and the admin unwind path is unchanged.
- Closed field maps for the computed-key writers: `MODERATION_CLEARABLE_TEXT_FIELDS` (per clearable surface), `WORK_SHELL_TEXT_FIELD_TO_HALL_ITEM_FIELD` (work shell text field → its published hall-item field), and `HALL_LIBRARY_TARGET_FIELDS` (upload origin → the doc field that receives the media-asset id). Each is `as const satisfies`, and a package test proves every value is a field the target document's schema actually declares, so a writer may keep its computed-key form without escaping the registry. `HALL_LIBRARY_TARGET_FIELDS` additionally ships the two WRITE-LEVEL subsets derived from that one map — the hall-parent cover origins and the chapter/track/episode sub-item origins, with their key-union types and type guards — so a processor that owns one level indexes only the fields the document it writes declares, and an origin added to the parent map fails to build until it is classified. The distinct fields of each subset ship too — `HALL_LIBRARY_COVER_ASSET_FIELDS` (the Hall parent's cover fields) and `HALL_LIBRARY_SUB_ITEM_ASSET_FIELDS` (a chapter / track / episode's media fields) — derived from the maps, so a reader that walks every Hall media reference (the orphan reaper, the Realm hide/restore cascade, the publisher) never restates a field list.
- `AuditEventType` catalog, `TTTAuditActor`, `TTTAuditTarget`, and `TTTAuditEvent` specialization of the `@ttt-productions/audit-core` generic. The union names the events the app writes, plus the two its planned legal-process intake owes (`childSafety.legalProcessRecorded`, `childSafety.evidenceDisposed`): public documents change only through `publicDocuments.released` (no per-page seed or edit types), a file reaches a Realm through its share request and approval (no instant-share type), and a Realm is recorded at its release. Credential and session records have their own types — `user.signedIn` (the sign-in the Identity Platform hook records) and `user.passwordResetCompleted` (a completed password reset, recorded from Identity Platform's own request log); there is no type for a password change, an email change, or an email recovery, which no server step records. The audit document carries the request origin in its own `ip`, `userAgent`, and `region` fields. A support thread has no deletion event: a thread is closed, never deleted.
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
  - A delivery row's state (`NotificationDeliveryStateSchema`, checked against notification-core's
    `DeliveryState`, whose ledger writes the rows): `queued`, `materialized`, `deadLetter`,
    or the terminal `skipped` — notification-core's materialize found the recipient ineligible (the
    app answers ineligible for an erased account), wrote no card, and stamped `skipReason`
    (`recipientIneligible`) and `skippedAt`, present exactly on a skipped row.
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
- **The pledge-totals formula** (`utils/pledge-totals`, root): `pledgePaymentTotalsOf(sums, pledgeCount)`
  builds every counter from the summed `PLEDGE_PAYMENT_SUMMED_AMOUNT_FIELDS` (`amount`, `netAmount`,
  `refundedAmount`, `disputeLostAmount`) — `totalRefunded` is refunds plus funds a lost dispute
  withdrew. Linear, so the Ops aggregate and the repair script apply it to ledger sums and the
  webhook applies it to one pledge before and after an event; none restates a counter.
- **Stored-enum display labels** (`constants/admin-labels`, root + `./constants`): what a screen shows for a stored enum
  value, one map per canonical union and keyed by it, so a new member fails the build until it has its text —
  `GUILD_INVITE_STATUS_LABELS`, `COMMISSION_PROPOSAL_STATUS_LABELS`, `HALL_SUB_ITEM_STATUS_LABELS`,
  `AUDITION_STATUS_LABELS`, `WORK_PROJECT_TYPE_LABELS`, `INVITE_SOURCE_TYPE_LABELS`, `SHORT_LINK_TARGET_TYPE_LABELS`
  (Audition / Audition entry / Commission / Hall entry), and `ADMIN_DISPATCH_STATUS_LABELS` (Open / User replied / Admin
  replied / Resolved / Closed — one set of words on every support-thread screen), and the safety case console's
  `CHILD_SAFETY_CASE_WORK_STATUS_LABELS` and `NCII_CASE_STATUS_LABELS`, beside the admin-surface maps in the same file. A screen renders the label, never the raw value.
- **Analytics event names** (`constants/analytics`, root + `./constants`): `ANALYTICS_EVENT_NAMES` is the one declaration of the
  events the app logs — the page view, sign-up, the creator funnel, and the payment funnel — and `AnalyticsEventName` the type
  the app's analytics hook takes, so an event cannot be logged without being declared here.
- **The refund and dispute lifecycle** (`doc-schemas/payments`, `utils/pledge-refund-eligibility`, `schemas/payments`).
  A refund request (`PledgeRefundRequestSchema`) moves `requested` → `approving` (an admin approved; recorded
  before Stripe is called, with `approvingAt`) → `initiated` → `completed`, or to `failed` (`failedAt`) when
  Stripe reports the refund failed, which also raises a `pledgeRefundFailed` admin task (the "Failed Pledge Refunds"
  queue beside the refund requests, counted in `OpsStatus.adminQueue.refundRequests`). An admin may deny a `requested`
  one, and closes a failed one's follow-up with the `resolveFailure` decision — the refund decision, never a generic
  check-in — which stamps `failureFollowUpResolvedAt` (only a failed request carries it). `PLEDGE_REFUND_REQUEST_STATUSES` is the
  status set, and `PLEDGE_REFUND_OPEN_STATUSES` the in-flight subset (`requested`, `approving`, `initiated`);
  `isPledgeRefundRequestOpen(request)` is whether a request still blocks a new one — in flight, or `failed` until its
  follow-up is resolved — so a pledge holds at most one open request and a supporter cannot ask again while a failed
  refund is being followed up. The server-only provider reference carries the refund an
  approval asked for (`refundCorrelation`: the request id, the whole-cent `intendedAmount`, and Stripe's `refundId`
  once it answers), the Stripe event time each handler last applied (`refundObservedAt`, `disputeObservedAt`, so a
  late event never regresses money or dispute state), and `lastRefundFailureReason` (within
  `MAX_INTERNAL_REASON_LENGTH`). The ledger's states come from `PLEDGE_REFUND_STATES` and `PLEDGE_DISPUTE_STATES`;
  each dispute only moves up the ladder none < underReview < won | lost (`pledgeDisputeStateRank`,
  `isPledgeDisputeAdvance`), and `isPledgeDisputeEventApplicable` keys it by dispute id — a different dispute than the
  provider reference's `disputeId` (a later dispute on the same charge) starts its own ladder, while `disputeObservedAt`
  keeps a late event of an earlier dispute from landing. The member-readable pledge tells its disputes apart without a
  Stripe id: `PledgePaymentSchema.disputeNumber` is 0 until the first dispute and then counts them (1, 2, …) — the
  schema requires 0 exactly when `disputeState` is `none` — and Stripe's dispute id stays on the server-only provider
  ref. `pledgeDisputeNumberForEvent(recorded, eventDisputeId)` is the number a dispute event writes (the recorded number
  for the provider ref's `disputeId`, one more for any other dispute), and `isPledgeDisputeTransitionLegal(before,
  after)` is the one rule an integrity check reads from the pledge alone: under the same number the state only climbs
  the ladder or stays; a number one higher is a new dispute starting at any state but `none` (its close may arrive
  before its opening); any other number change is illegal. Eligibility is one rule: `pledgeRefundRequestRefusal(pledge, callerUid, now, latestRequest)`
  answers the refusal in order — `not-owner`, `window-expired` (past `PLEDGE_REFUND_REQUEST_WINDOW_MS`), `ineligible`
  (something refunded, an open or lost dispute, or no money left), `already-open` (the pledge's latest request is still
  open; `PLEDGE_REFUND_REQUEST_REFUSALS`) — or null, so the request callable
  keeps each refusal's own answer and audit reason; `isPledgeRefundRequestable` is its yes/no for the pledge page — and `isPledgeRefundApprovable(pledge, requestAmount)`, the same pristine test plus a live net still equal to
  the requested amount. The checkout success page's lookup is `GetMyPledgeByCheckoutSessionInputSchema` and answers
  `PledgeDisplaySchema`, the ledger's display fields built from its own field schemas. Stake shares are whole numbers:
  `GuildmateUserSchema.stakeShareCount` is a non-negative integer, a pending reservation a positive one, and a stored offer
  (a commission listing's or audition's, up to `MAX_WORK_PROJECT_STAKE_SHARES`, and a guild invite's) a positive one; the
  stake-share audit event keeps whatever number it found, so an anomalous value is still recorded.
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
  `targetStatus`; an entry without `authEffect` is one of these), `publicDocumentsAcceptedClaim`,
  `adminClaims` (the admin-role claims after a roster change), or `registeredMemberClaim` (the last
  three strict, no `targetStatus`). The drain re-converges every Auth-side mirror of the uid from
  canonical docs whichever effect queued it.
- **The registered-member claim** (`REGISTERED_MEMBER_CLAIM` = `registeredMember`, root, beside
  `PUBLIC_DOCUMENTS_ACCEPTED_CLAIM`): `true` on an account whose registration finished. The
  member-content read rules require it, so a bare login that skipped the age step reads nothing;
  registration sets it and the claim reconciler re-derives it from canonical state.

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
- A Work's invite history is read a page at a time: `ListGuildInvitesInputSchema` takes the opaque
  `cursor` the previous page answered (no client page size — the server reads
  `ITEMS_PER_PAGE_GUILD_INVITES`), and `ListGuildInvitesResultSchema` (declared beside the invite doc
  in `doc-schemas/messaging`, re-exported from `./schemas`) answers the page's invites in their stored
  shape plus `nextCursor`, `null` on the last page.

When adding a new invite source or commission-proposal lifecycle state, update the schema here first and then publish/consume it in `ttt-prod`. Do not add parallel frontend/backend interfaces in the app.


## Work guild-standing and action ownership

`ttt-core` owns the work guild-standing contract consumed by both `ttt-prod` frontend code and Cloud Functions code. The durable source files are:

- `src/permissions/work-project-permissions.ts` — `GUILD_STANDINGS`, `WORK_PROJECT_ACTIONS`, guild-standing/action type guards, and helpers.
- `src/permissions/guild-standing-assignment-policy.ts` — who may assign or remove each guild standing.
- `src/schemas/work-project-management.ts` — guild-standing/trade-profession update callable input schemas.

Consumers should not duplicate guild-standing option maps or action matrices locally. UI affordances may read the package catalog, but backend work-project-action checks remain authoritative in the consuming app.

The launch-era steward model is guild-standing-based: `StewardOwner` is the first `GuildStandingId`, appears in every `WORK_PROJECT_ACTIONS[action].grantedTo` list, and is stored on the consuming app's `allWorkProjects/{workProjectId}/guildmateUsers/{uid}.guildStandings` guildmate document. `StewardOwner` is still non-assignable through the normal guild-standing-management policy; work creation seeds it, and future steward-transfer/co-steward work must design a dedicated flow instead of bypassing `canAssignGuildStanding`.


## Upload target authority

Hall-library cover and sub-item upload `targetInfo` schemas carry typed ids only. They must not accept client-provided Firestore paths or field maps. Every target-info id (and the matching upload-variables id) is its entity's id atom, so each is exactly one document-id segment before `startUpload` builds a path from it. The consuming backend derives final document paths through `PATH_BUILDERS`, derives media asset fields through `HALL_LIBRARY_TARGET_FIELDS`, and validates a persisted sub-item job's origin/surface pair through `HALL_LIBRARY_SUB_ITEM_SURFACE_BY_ORIGIN` from `src/media/hall-library-target-fields.ts`.

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

A Realm a new Work may be built into, and that Realm search lists, is a released public Realm:
`RELEASED_PUBLIC_REALM_CRITERIA` (`utils/work-realm-eligibility`, root + `./utils`) is the one
statement of it — `public`, `released`, not hidden by moderation — and the backend check
(`isReleasedPublicRealm`) and the search filters (`RELEASED_PUBLIC_REALM_EQUALITY_FILTERS`, the
`{ field, value }` equality filters a Firestore search takes) both derive from it. Each Works list on
a Realm's page reads `ITEMS_PER_PAGE_REALM_WORKS` (12) Works per page.

A Work's `status` (`FullWorkProjectSchema`) is `open` from creation and `published` once its first Hall item
publishes; nothing else is written. The create callable's answer is `CreateWorkProjectResultSchema`
(`schemas/work-project-management`, `./schemas`, beside `CreateWorkProjectInputSchema`): `success: true`, the new
Work's `workProjectId`, and its stored `FullWorkProjectSchema` document, whose own id the answered id must match. A draft public Realm needs its cover before the founding Work's first submit for
library review, because that Work's first publish releases the Realm.

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
- **Working copies.** Each document has one private working copy whose `revision` counts its saves
  from 1. A save names the revision its editor opened (`expectedRevision`, 0 when it opened with
  none) and a publish names, per document, the revision it reviewed (`drafts`, one
  `PublicDocumentDraftRevisionRef` each); the server refuses either once another save has moved the
  revision, so one admin's save never silently replaces another's and a release publishes exactly
  the reviewed text. The save answers the revision it wrote.
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
