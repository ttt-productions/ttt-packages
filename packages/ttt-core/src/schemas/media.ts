import { z } from 'zod';
import {
  workProjectIdSchema,
  guildInviteIdSchema,
  workFileFolderIdSchema,
  commissionListingIdSchema,
  commissionProposalIdSchema,
  adminDispatchIdSchema,
  reportGroupIdSchema,
  mediaAssetIdSchema,
  workRealmIdSchema,
  realmFileShareRequestIdSchema,
} from './atoms.js';

// Scoped-media grant requests for the gateway Worker: the scoped tier is a session cookie plus a
// user-bound grant. These are the CLIENT-CALLED wire contracts of the two grant callables, so they
// live here, not in the functions repo. The EXACT Firestore permission check happens in the
// callable; a schema only pins the shape. A custom folder's bytes must be unreachable outside its
// view trade-professions, so `workFileFolder` is the EXACT folder scope (not the whole Work grant);
// guildInvite / adminSupport are the two per-CONVERSATION scopes that serve Conversation Files
// (guild chat channels have none — no guildChannel scope).
//
// Admin authority is a callable of its own (BACKEND-004): `createMediaGrant` serves a
// participant, `adminCreateMediaGrant` an admin acting in review or support, and spends a
// single-use App Check token. Each scope is declared once and joins the union of every callable
// that serves it.

// Pre-publish content media of a work project (hall covers / sub-item media). A participant needs
// project read membership; an admin reaches it from a review surface. Work FILES use the tighter
// workFileFolder scope.
const WorkProjectGrantScopeSchema = z
  .object({
    scopeKind: z.literal('workProject'),
    workProjectId: workProjectIdSchema,
  })
  .strict();

// One work-project FILE FOLDER — the EXACT folder scope, NOT the whole-Work grant.
const WorkFileFolderGrantScopeSchema = z
  .object({
    scopeKind: z.literal('workFileFolder'),
    workProjectId: workProjectIdSchema,
    workFileFolderId: workFileFolderIdSchema,
  })
  .strict();

// One commission proposal's media — proposal author or listing-side manager.
const CommissionProposalGrantScopeSchema = z
  .object({
    scopeKind: z.literal('commissionProposal'),
    commissionListingId: commissionListingIdSchema,
    commissionProposalId: commissionProposalIdSchema,
  })
  .strict();

// A guild-INVITE conversation's Conversation File (no workProjectId to match on).
const GuildInviteGrantScopeSchema = z
  .object({
    scopeKind: z.literal('guildInvite'),
    guildInviteId: guildInviteIdSchema,
  })
  .strict();

// An admin-support THREAD's Conversation File — per-thread scope keyed by adminDispatchId: the
// thread owner through `createMediaGrant`, the admin side through `adminCreateMediaGrant`.
const AdminSupportGrantScopeSchema = z
  .object({
    scopeKind: z.literal('adminSupport'),
    adminDispatchId: adminDispatchIdSchema,
  })
  .strict();

// Moderation reveal of ONE reported asset, bound to its report group — full or jr admin only. The
// callable verifies the asset belongs to the group's derived target (or its frozen report-time
// snapshot) before minting; the grant is bound to exactly that asset id, short TTL. Admins see
// reported things BECAUSE they were reported — this is never a browse-any-asset scope.
const AdminReviewGrantScopeSchema = z
  .object({
    scopeKind: z.literal('adminReview'),
    reportGroupId: reportGroupIdSchema,
    mediaAssetId: mediaAssetIdSchema,
  })
  .strict();

// A Realm steward's preview of ONE Work file awaiting their promotion decision — the Realm's
// current steward only, and only while the file is still pending under this request id in this
// Realm (the callable re-checks all three at mint). The request id is the one the steward's queue
// row showed, so a decided, withdrawn, or superseded request mints nothing. The grant names
// exactly that asset and never reveals a hidden one.
const RealmFilePreviewGrantScopeSchema = z
  .object({
    scopeKind: z.literal('realmFilePreview'),
    workRealmId: workRealmIdSchema,
    mediaAssetId: mediaAssetIdSchema,
    realmFileShareRequestId: realmFileShareRequestIdSchema,
  })
  .strict();

/** The `createMediaGrant` input: a participant's scopes. */
export const CreateMediaGrantInputSchema = z.discriminatedUnion('scopeKind', [
  WorkProjectGrantScopeSchema,
  WorkFileFolderGrantScopeSchema,
  CommissionProposalGrantScopeSchema,
  GuildInviteGrantScopeSchema,
  AdminSupportGrantScopeSchema,
  RealmFilePreviewGrantScopeSchema,
]);
export type CreateMediaGrantInput = z.infer<typeof CreateMediaGrantInputSchema>;

/** The `adminCreateMediaGrant` input: the scopes an admin reaches as an admin. */
export const AdminCreateMediaGrantInputSchema = z.discriminatedUnion('scopeKind', [
  WorkProjectGrantScopeSchema,
  AdminSupportGrantScopeSchema,
  AdminReviewGrantScopeSchema,
]);
export type AdminCreateMediaGrantInput = z.infer<typeof AdminCreateMediaGrantInputSchema>;

/** Both grant callables answer the same signed grant, bound to the caller. */
export const CreateMediaGrantResultSchema = z
  .object({
    grant: z.string().min(1),
    /** Epoch ms; a client refreshes under it. */
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type CreateMediaGrantResult = z.infer<typeof CreateMediaGrantResultSchema>;
