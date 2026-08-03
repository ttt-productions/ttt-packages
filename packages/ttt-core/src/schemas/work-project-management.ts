import { z } from 'zod';
import {
  workProjectIdSchema,
  userIdSchema,
  addRemoveActionSchema,
  workProjectTypeSchema,
  hallWingTypeSchema,
  commissionListingIdSchema,
  commissionProposalIdSchema,
  auditionIdSchema,
  auditionEntryIdSchema,
  craftSkillIdSchema,
  guildInviteConversationStatusSchema,
  mediaAssetIdSchema,
  workRealmIdSchema,
  realmFileFolderIdSchema,
  realmFileShareRequestIdSchema,
} from './atoms.js';
import { TRADE_PROFESSION_OPTIONS, TRADE_PROFESSION_VALUES } from '../constants/options.js';
import { GUILD_STANDING_VALUES } from '../permissions/index.js';
import {
  MAX_GUILD_INVITE_MESSAGE_LENGTH,
  MAX_WORK_PROJECT_TITLE_LENGTH,
  MAX_WORK_PROJECT_DESCRIPTION_LENGTH,
  MAX_WORK_REALM_TITLE_LENGTH,
  MAX_WORK_REALM_DESCRIPTION_LENGTH,
  MAX_CRAFT_SKILL_NAME_LENGTH,
  MAX_FILE_FOLDER_NAME_LENGTH,
} from '../constants/business.js';
import {
  REALM_SHARED_FILES_PAGE_LIMIT,
  REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT,
} from '../constants/pagination.js';
import {
  RealmFileApprovedStatusSchema,
  RealmFilePendingApprovalStatusSchema,
  RealmFileActiveStatusSchema,
  REALM_FILE_PENDING_APPROVAL_STATUS,
  ContentMediaKindSchema,
} from '../doc-schemas/media-assets.js';

// ===========================================================================
// S7 realm shared-files gallery (ARTISAN-ONLY, plus a full-admin bypass for the admin-only
// un-share support action). `mediaAssets` is client-unreadable, so the gallery reads
// realm-shared work files via THIS server projection callable (never a client query) — and
// for the same reason the Realm's FOLDER documents are returned through the same projection
// owner rather than opened to direct client reads: artisan / admin / hidden-Realm access is
// decided in ONE backend owner.
//
// Serving is the `'artisan'` media tier (mutate-in-place scoped→artisan at APPROVAL — see the
// approval gate below). V1 = view + download, grouped by the steward's folders.
// ===========================================================================

/** One APPROVED shared file. Accepts only the two approved standings — a pending or
 *  unshared row is structurally inexpressible in this response. */
export const RealmSharedFileProjectionSchema = z.object({
  mediaAssetId: mediaAssetIdSchema,
  // The canonical stored media kind — RealmSharedFileProjection is a projection OF a
  // MediaAsset, so it shares the ONE ContentMediaKindSchema.
  mediaKind: ContentMediaKindSchema,
  // Never the full status union: 'nonCanon' | 'canon' only.
  realmFileCanonStatus: RealmFileApprovedStatusSchema,
  /** The Work file's own `name`. A file browser that groups unnamed thumbnails by folder is
   *  not a file browser — the name is part of the projection, not something the client is
   *  expected to resolve. (It is file metadata, NOT display identity: creator names and
   *  avatars still resolve at render from `creatorUid`.) */
  name: z.string(),
  /** The steward-assigned folder this file sits in. Always present — approval IS folder
   *  assignment, so an approved file without a folder cannot exist. */
  realmFileFolderId: realmFileFolderIdSchema,
  creatorUid: userIdSchema,
  // For the per-file steward canon toggle + download (updateWorkFileRealmCanon takes these).
  workProjectId: workProjectIdSchema,
  workFileId: z.string(),
}).strict();
export type RealmSharedFileProjection = z.infer<typeof RealmSharedFileProjectionSchema>;

/** A Realm shared-file folder as the gallery sees it. The FOLDER DOCUMENT stores no counts;
 *  `fileCount` here is SERVER-COMPUTED per response, so it can never drift the way a stored
 *  counter would. */
export const RealmFileFolderProjectionSchema = z.object({
  realmFileFolderId: realmFileFolderIdSchema,
  name: z.string(),
  /** Number of files currently ASSIGNED to this folder — counting every assigned file
   *  regardless of canon state and regardless of serving state (a hidden or quarantined file
   *  still occupies its folder, and is still why a delete-folder attempt will refuse).
   *  Server-computed so the steward UI stops deriving counts from whichever gallery pages
   *  happen to be loaded — a paged client can only ever see part of a folder. */
  fileCount: z.number().int().min(0),
}).strict();
export type RealmFileFolderProjection = z.infer<typeof RealmFileFolderProjectionSchema>;

// Paginated: the pre-approval-gate query was unbounded. `limit` is bounded by the ONE named
// page constant the server also clamps to, and `cursor` is an OPAQUE server-minted token —
// the client never constructs or interprets it, so the ordering fields stay a server detail.
export const GetRealmSharedFilesInputSchema = z.object({
  realmId: workRealmIdSchema,
  limit: z.number().int().min(1).max(REALM_SHARED_FILES_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
}).strict();
export type GetRealmSharedFilesInput = z.infer<typeof GetRealmSharedFilesInputSchema>;

/** `{ files }` is preserved as-is; `folders` and `nextCursor` are ADDITIVE. `folders` is the
 *  Realm's complete folder set (bounded by MAX_REALM_FILE_FOLDERS), not a page — the gallery
 *  must be able to render an empty folder, and the steward must see one to move files into.
 *  `nextCursor` is absent/null on the last page. */
export const GetRealmSharedFilesResponseSchema = z.object({
  files: z.array(RealmSharedFileProjectionSchema),
  folders: z.array(RealmFileFolderProjectionSchema),
  nextCursor: z.string().min(1).nullable().optional(),
}).strict();
export type GetRealmSharedFilesResponse = z.infer<typeof GetRealmSharedFilesResponseSchema>;

// ---- realm-file promotion queue (steward / full admin) ---------------------------------
// A SEPARATE bounded projection rather than an `includePending` flag on the artisan gallery:
// a caller-controlled flag would put "may this caller see pending rows" in the client's
// hands. Ordinary artisans can never enumerate pending requests.

/** One AWAITING-DECISION request. Accepts only the pending-approval standing (via
 *  RealmFilePendingApprovalStatusSchema) — an approved or unshared row is structurally
 *  inexpressible in the queue. */
export const RealmFilePromotionQueueRowSchema = z.object({
  mediaAssetId: mediaAssetIdSchema,
  mediaKind: ContentMediaKindSchema,
  realmFileCanonStatus: RealmFilePendingApprovalStatusSchema,
  /** The Work file's own name — the steward decides on a named file, not a thumbnail. */
  name: z.string(),
  creatorUid: userIdSchema,
  workProjectId: workProjectIdSchema,
  workFileId: z.string(),
  /** Echoed so the approve/decline call can carry the exact observed request id; a stale tab
   *  deciding a superseded request is then a visible conflict, not a silent overwrite. */
  realmFileShareRequestId: realmFileShareRequestIdSchema,
  /** The RECORDED requester — the resolution notification is addressed from this, never
   *  guessed from the uploader. */
  realmFileShareRequestedByUid: userIdSchema,
  realmFileShareRequestedAt: z.number(),
}).strict();
export type RealmFilePromotionQueueRow = z.infer<typeof RealmFilePromotionQueueRowSchema>;

export const GetRealmFilePromotionQueueInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  limit: z.number().int().min(1).max(REALM_FILE_PROMOTION_QUEUE_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
}).strict();
export type GetRealmFilePromotionQueueInput = z.infer<typeof GetRealmFilePromotionQueueInputSchema>;

/** `folders` rides along so the approval UI can offer the folder picker (and detect the
 *  "no folders yet" state) without a second round-trip. */
export const GetRealmFilePromotionQueueResponseSchema = z.object({
  requests: z.array(RealmFilePromotionQueueRowSchema),
  folders: z.array(RealmFileFolderProjectionSchema),
  nextCursor: z.string().min(1).nullable().optional(),
}).strict();
export type GetRealmFilePromotionQueueResponse = z.infer<typeof GetRealmFilePromotionQueueResponseSchema>;

// ---- WORK-side share-state projection --------------------------------------------------
// The mirror image of the two Realm-side projections above, for the WORK's own files surface:
// a file admin looking at their folder listing needs to know which files are already shared
// or awaiting a steward decision, so the row can show "Requested" / "Shared" and offer
// withdraw where it applies.
//
// It is a SERVER projection for the same reason the gallery is: `mediaAssets` is
// client-unreadable, so share state cannot be read from the file document. File-admin
// authorization is asserted in the callable; this shape carries no authority hint.

/** One work file's realm-share state.
 *
 *  The `requestId` is present EXACTLY while the file is awaiting a decision — it is what the
 *  withdraw call must carry, and it is meaningless once the request is resolved. Enforced
 *  rather than merely optional, mirroring the asset's own legal-combination invariant, so the
 *  UI can never be handed a pending row with nothing to withdraw (or an approved row carrying
 *  a stale request id it might send).
 *
 *  `workFileId` uses plain `z.string()` like the sibling projection rows in this file
 *  (inputs use `.min(1)`; projection rows describe server-produced data). */
export const WorkFileRealmShareStateSchema = z.object({
  workFileId: z.string(),
  // Never `none`: an unshared file simply has no row (see the response below).
  realmFileCanonStatus: RealmFileActiveStatusSchema,
  realmFileShareRequestId: realmFileShareRequestIdSchema.optional(),
}).strict().superRefine((val, ctx) => {
  const isPending = val.realmFileCanonStatus === REALM_FILE_PENDING_APPROVAL_STATUS;
  if (isPending && val.realmFileShareRequestId === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['realmFileShareRequestId'],
      message: 'a pending row must carry its request id — it is what the withdraw call compares against',
    });
  }
  if (!isPending && val.realmFileShareRequestId !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['realmFileShareRequestId'],
      message: 'a resolved row must not carry a request id — the request is no longer pending',
    });
  }
});
export type WorkFileRealmShareState = z.infer<typeof WorkFileRealmShareStateSchema>;

export const GetWorkFileRealmShareStatesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
}).strict();
export type GetWorkFileRealmShareStatesInput = z.infer<typeof GetWorkFileRealmShareStatesInputSchema>;

/** Rows exist ONLY for files whose standing is not `none`. An ABSENT row therefore means the
 *  file has never been requested or shared — that is the encoding, so the client must treat a
 *  missing entry as "not shared" rather than "unknown". Bounded implicitly by the Work's own
 *  file cap (MAX_WORK_FILES), so this response needs no page cursor of its own. */
export const GetWorkFileRealmShareStatesResponseSchema = z.object({
  states: z.array(WorkFileRealmShareStateSchema),
}).strict();
export type GetWorkFileRealmShareStatesResponse = z.infer<typeof GetWorkFileRealmShareStatesResponseSchema>;

const baseFields = {
  workingTitle: z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH),
  workingDescription: z.string().min(1).max(MAX_WORK_PROJECT_DESCRIPTION_LENGTH),
  workProjectType: workProjectTypeSchema,
  hallWingType: hallWingTypeSchema,
};

// A Realm working title is reserved under `reservedRealmNames/{UPPER(title)}` — the
// UPPERCASED title IS the Firestore doc ID (runCreateWorkRealm.reservedRealmNameRef).
// Firestore doc IDs cannot contain `/` and cannot be exactly `.` or `..`, so a title
// that would produce an invalid/ambiguous doc ID must be rejected at the callable
// boundary (both the create transaction and the soft availability check) rather than
// hard-failing with an opaque `internal` error deep inside ref construction. Length
// derives from MAX_WORK_REALM_TITLE_LENGTH; only the doc-ID-breaking characters are
// forbidden. Keep CheckRealmNameAvailableInputSchema in lockstep so a valid-at-create
// name is never rejected at form time (and vice-versa).
export const realmWorkingTitleSchema = z
  .string()
  .min(1)
  .max(MAX_WORK_REALM_TITLE_LENGTH)
  .refine((v) => !v.includes('/'), { message: 'Realm name cannot contain a slash (/).' })
  .refine((v) => v !== '.' && v !== '..', { message: 'Realm name cannot be "." or "..".' });

export const RealmCreationModeSchema = z.enum([
  'newPublicRealm',
  'newStandaloneRealm',
  'existingPublicRealm',
]);
export type RealmCreationMode = z.infer<typeof RealmCreationModeSchema>;

export const CreateWorkProjectInputSchema = z.discriminatedUnion('realmCreationMode', [
  z.object({
    ...baseFields,
    realmCreationMode: z.literal('newPublicRealm'),
    realmWorkingTitle: realmWorkingTitleSchema,
    realmWorkingDescription: z.string().min(1).max(MAX_WORK_REALM_DESCRIPTION_LENGTH),
  }).strict(),
  // Standalone realms are background plumbing (DJ ruling 2026-07-19): the user enters NO
  // realm information — the backend creates the realm shell with a synthetic unique
  // title/description (the generated workRealmId), so nothing user-authored exists on it
  // and no human realm name is consumed from the reservedRealmNames namespace.
  z.object({
    ...baseFields,
    realmCreationMode: z.literal('newStandaloneRealm'),
  }).strict(),
  z.object({
    ...baseFields,
    realmCreationMode: z.literal('existingPublicRealm'),
    workRealmId: z.string().min(1),
  }).strict(),
]);
export type CreateWorkProjectInput = z.infer<typeof CreateWorkProjectInputSchema>;

// Identified by the workAssets subcollection doc id — never by URL parsing
// (no delete path may depend on a URL; see media-assets-and-protected-serving.md).
export const DeleteWorkAssetInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workAssetId: z.string().min(1),
}).strict();
export type DeleteWorkAssetInput = z.infer<typeof DeleteWorkAssetInputSchema>;

export const InviteSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('standalone'),
  }).strict(),
  z.object({
    type: z.literal('craftSkill'),
    data: z.object({
      craftSkillId: craftSkillIdSchema,
      craftSkillOwnerUserId: userIdSchema,
      craftSkillName: z.string().min(1).max(MAX_CRAFT_SKILL_NAME_LENGTH),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('commission'),
    // Titles are NOT snapshotted here (Display Identity Invariant — client display text
    // must be re-sourced at render by id). `postingStakeSharesOffered` is not display text;
    // the server re-sources it from the posting doc in the invite transaction (never trusts
    // the client copy) — kept so the shape stays server-writable.
    data: z.object({
      commissionListingId: commissionListingIdSchema,
      commissionProposalId: commissionProposalIdSchema,
      proposalArtisanUserId: userIdSchema,
      postingStakeSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
  z.object({
    type: z.literal('audition'),
    data: z.object({
      auditionId: auditionIdSchema,
      auditionEntryId: auditionEntryIdSchema,
      respondentUserId: userIdSchema,
      postingStakeSharesOffered: z.number().int().min(1),
    }).strict(),
  }).strict(),
]);
export type InviteSource = z.infer<typeof InviteSourceSchema>;
export type InviteSourceType = InviteSource['type'];

export const InviteUserToGuildInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  inviteeUid: userIdSchema,
  message: z.string().min(1).max(MAX_GUILD_INVITE_MESSAGE_LENGTH),
  stakeSharesOffered: z.number().int().min(1),
  source: InviteSourceSchema,
}).strict();
export type InviteUserToGuildInput = z.infer<typeof InviteUserToGuildInputSchema>;

// `finalized` is the terminal SUCCESS state (`accepted` is a transient state a trigger
// consumes within seconds). Managers must be able to list finalized invites to see the
// guild's actual recruitment history — not only failures and in-flight items. Derives from
// the ONE canonical status enum (schemas/atoms.ts), never a re-declared literal.
export const ListGuildInvitesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  statuses: z.array(guildInviteConversationStatusSchema).min(1),
}).strict();
export type ListGuildInvitesInput = z.infer<typeof ListGuildInvitesInputSchema>;

export const UpdateGuildmateTradeProfessionsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  userId: userIdSchema,
  tradeProfession: z.enum(TRADE_PROFESSION_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateGuildmateTradeProfessionsInput = z.infer<typeof UpdateGuildmateTradeProfessionsInputSchema>;

const GUILD_STANDING_VALUES_ENUM = GUILD_STANDING_VALUES as [typeof GUILD_STANDING_VALUES[number], ...typeof GUILD_STANDING_VALUES[number][]];

export const UpdateGuildmateStandingInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  userId: userIdSchema,
  guildStanding: z.enum(GUILD_STANDING_VALUES_ENUM),
  action: addRemoveActionSchema,
}).strict();
export type UpdateGuildmateStandingInput = z.infer<typeof UpdateGuildmateStandingInputSchema>;

// Member self-leave (leaveWorkProject). The leaver is ALWAYS request.auth.uid — never a
// client-supplied uid (invariant 3) — so the input carries only the workProjectId. The
// callable composes the internal `depart` stake-share operation for ctx.uid.
export const LeaveWorkProjectInputSchema = z.object({
  workProjectId: workProjectIdSchema,
}).strict();
export type LeaveWorkProjectInput = z.infer<typeof LeaveWorkProjectInputSchema>;

export const UpdatePublicWorkProjectDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workingTitle: z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH),
  workingDescription: z.string().min(1).max(MAX_WORK_PROJECT_DESCRIPTION_LENGTH),
}).strict();
export type UpdatePublicWorkProjectDetailsInput = z.infer<typeof UpdatePublicWorkProjectDetailsInputSchema>;

export const UpdateWorkRealmDetailsInputSchema = z.object({
  workRealmId: z.string().min(1),
  workingTitle: z.string().min(1).max(MAX_WORK_REALM_TITLE_LENGTH),
  workingDescription: z.string().min(1).max(MAX_WORK_REALM_DESCRIPTION_LENGTH),
}).strict();
export type UpdateWorkRealmDetailsInput = z.infer<typeof UpdateWorkRealmDetailsInputSchema>;

// Unauthenticated soft-check for a Realm working title. Must match the authoritative
// realmWorkingTitle contract in CreateWorkProjectInputSchema (realmWorkingTitleSchema:
// MAX_WORK_REALM_TITLE_LENGTH, rejecting the doc-ID-breaking `/` and reserved `.`/`..`). Never be
// stricter than the create transaction or a valid-at-create name would be rejected at
// form time — reuse the SAME schema so the two can never drift.
export const CheckRealmNameAvailableInputSchema = z.object({
  workingTitle: realmWorkingTitleSchema,
}).strict();
export type CheckRealmNameAvailableInput = z.infer<typeof CheckRealmNameAvailableInputSchema>;

// ---- work-project file folders (S7) ---------------------------------------------------
// The default "All Guildmates" folder is immutable; custom-folder access is by trade
// profession. All four callables require a file-admin standing via assertCanManageFolders.

const tradeProfessionListSchema = z
  .array(z.enum(TRADE_PROFESSION_VALUES))
  .max(TRADE_PROFESSION_OPTIONS.length);

export const CreateFileFolderInputSchema = z.object({
  workProjectId: z.string().min(1),
  name: z.string().min(1).max(MAX_FILE_FOLDER_NAME_LENGTH),
  canViewTradeProfessions: tradeProfessionListSchema,
  canUploadTradeProfessions: tradeProfessionListSchema,
  canDeleteTradeProfessions: tradeProfessionListSchema,
}).strict();
export type CreateFileFolderInput = z.infer<typeof CreateFileFolderInputSchema>;

export const RenameFileFolderInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
  name: z.string().min(1).max(MAX_FILE_FOLDER_NAME_LENGTH),
}).strict();
export type RenameFileFolderInput = z.infer<typeof RenameFileFolderInputSchema>;

export const UpdateFolderProfessionsInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
  canViewTradeProfessions: tradeProfessionListSchema,
  canUploadTradeProfessions: tradeProfessionListSchema,
  canDeleteTradeProfessions: tradeProfessionListSchema,
}).strict();
export type UpdateFolderProfessionsInput = z.infer<typeof UpdateFolderProfessionsInputSchema>;

export const DeleteFileFolderInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
}).strict();
export type DeleteFileFolderInput = z.infer<typeof DeleteFileFolderInputSchema>;

// ---- realm shared files ---------------------------------------------------------------

// Delete a single work file (by folder + file id). File-admin authz is enforced in the
// callable/core transaction.
export const DeleteWorkFileInputSchema = z.object({
  workProjectId: z.string().min(1),
  folderId: z.string().min(1),
  workFileId: z.string().min(1),
}).strict();
export type DeleteWorkFileInput = z.infer<typeof DeleteWorkFileInputSchema>;

// Set canon status on a realm shared file. Realm-steward-only authz is enforced inside the
// core's transaction against workRealms/{workRealmId}.workStewardUid.
export const UpdateWorkFileRealmCanonInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  mediaAssetId: mediaAssetIdSchema,
  canon: z.boolean(),
}).strict();
export type UpdateWorkFileRealmCanonInput = z.infer<typeof UpdateWorkFileRealmCanonInputSchema>;

// ---- the promotion approval gate -------------------------------------------------------
// Promotion is a REQUEST, not an instant share: the Work file admin asks, and the REALM
// steward approves (choosing the folder) or declines. Nothing is served to the Realm until
// approval — a requested file stays `scoped` and invisible to the member gallery.
//
// Every one of these carries the `requestId` so a decision always names the exact request it
// observed. Realm-side authority (steward, public + non-hidden Realm) is derived from the
// Realm document inside each core's transaction; these shapes carry no authority hints.

// REQUEST promotion of a work file into its Realm's shared-file pool. File-admin authz
// (`workFile.promoteToRealm`) is enforced inside the core's transaction.
// `requestId` is CLIENT-generated and stable: replaying the same id is an idempotent success
// (no second audit event, no second notification), while a DIFFERENT id arriving while one
// request is already pending is a conflict — never a silent overwrite.
export const UpdateWorkFileRealmShareInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workFileId: z.string().min(1),
  requestId: realmFileShareRequestIdSchema,
}).strict();
export type UpdateWorkFileRealmShareInput = z.infer<typeof UpdateWorkFileRealmShareInputSchema>;

// WITHDRAW a still-pending request (the requesting Work's file admin). Realm-share
// permanence begins at APPROVAL — before a steward decides, an accidental request must be
// correctable by the side that made it. Addressed by Work coordinates like the request
// itself, and compares `requestId` so a withdrawal can never cancel a newer re-request.
export const WithdrawRealmFilePromotionRequestInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workFileId: z.string().min(1),
  requestId: realmFileShareRequestIdSchema,
}).strict();
export type WithdrawRealmFilePromotionRequestInput = z.infer<typeof WithdrawRealmFilePromotionRequestInputSchema>;

// APPROVE a pending request (Realm steward). Approval assigns the folder — there is no
// default folder, so `realmFileFolderId` is REQUIRED and the core verifies the folder is
// under this exact Realm before flipping the file to `nonCanon` + the artisan tier.
export const ApproveRealmFilePromotionInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  mediaAssetId: mediaAssetIdSchema,
  realmFileFolderId: realmFileFolderIdSchema,
  requestId: realmFileShareRequestIdSchema,
}).strict();
export type ApproveRealmFilePromotionInput = z.infer<typeof ApproveRealmFilePromotionInputSchema>;

// DECLINE a pending request (Realm steward). Returns the file to `none` and clears the Realm
// + request fields. No folder is involved — a declined file never entered the pool.
export const DeclineRealmFilePromotionInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  mediaAssetId: mediaAssetIdSchema,
  requestId: realmFileShareRequestIdSchema,
}).strict();
export type DeclineRealmFilePromotionInput = z.infer<typeof DeclineRealmFilePromotionInputSchema>;

// ADMIN un-share of an ALREADY-APPROVED realm file (`adminUpdateWorkFileRealmUnshare`).
// Once a steward approves, sharing is PERMANENT for members — the only way out is an admin
// acting on a support thread. This is its own input rather than a reuse of the share/request
// shape: an approved file has NO pending request, so `requestId` is meaningless here and
// requiring one would make the callable unusable against exactly the state it exists to
// unwind. It carries the ORIGINAL two-field Work-coordinate shape the share input had before
// the approval gate; the core resolves the file by collection-group query on
// (`workProjectId`, `workFileId`). Admin authority is asserted at the callable's admin gate
// and re-asserted in the core (which rejects any non-`adminOverride` actor) — never inferred
// from anything in this payload.
export const AdminUpdateWorkFileRealmUnshareInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workFileId: z.string().min(1),
}).strict();
export type AdminUpdateWorkFileRealmUnshareInput = z.infer<typeof AdminUpdateWorkFileRealmUnshareInputSchema>;

// ---- realm shared-file folders (steward-managed) ---------------------------------------
// Mirrors the Work-side folder CRUD shapes, minus the trade-profession access lists: Realm
// folders are organizational only (Realm-level visibility is the whole access model at
// launch). Names reuse the ONE platform folder-name bound; the server derives
// `name_lowercase` and enforces case-insensitive uniqueness within the Realm.

export const CreateRealmFileFolderInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  name: z.string().min(1).max(MAX_FILE_FOLDER_NAME_LENGTH),
}).strict();
export type CreateRealmFileFolderInput = z.infer<typeof CreateRealmFileFolderInputSchema>;

/** Rename. `update*` per BACKEND-305 — it modifies an existing doc in place. */
export const UpdateRealmFileFolderInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  realmFileFolderId: realmFileFolderIdSchema,
  name: z.string().min(1).max(MAX_FILE_FOLDER_NAME_LENGTH),
}).strict();
export type UpdateRealmFileFolderInput = z.infer<typeof UpdateRealmFileFolderInputSchema>;

/** Delete requires the folder to be EMPTY (the steward moves files out first) — no surprise
 *  data moves and no reassignment-target picker at launch. Emptiness is proven by an
 *  in-transaction query for ANY asset carrying this folder id, regardless of serving/hidden/
 *  canon state: a hidden file still occupies its folder. */
export const DeleteRealmFileFolderInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  realmFileFolderId: realmFileFolderIdSchema,
}).strict();
export type DeleteRealmFileFolderInput = z.infer<typeof DeleteRealmFileFolderInputSchema>;

/** Move an approved shared file between folders. `expectedRealmFileFolderId` is a
 *  compare-and-set precondition — a steward acting on a stale view must not silently undo a
 *  move made from another tab. */
export const UpdateRealmFileFolderAssignmentInputSchema = z.object({
  workRealmId: workRealmIdSchema,
  mediaAssetId: mediaAssetIdSchema,
  expectedRealmFileFolderId: realmFileFolderIdSchema,
  realmFileFolderId: realmFileFolderIdSchema,
}).strict();
export type UpdateRealmFileFolderAssignmentInput = z.infer<typeof UpdateRealmFileFolderAssignmentInputSchema>;


