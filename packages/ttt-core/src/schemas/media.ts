import { z } from 'zod';
import {
  workProjectIdSchema,
  guildChatChannelIdSchema,
  guildInviteIdSchema,
  workFileFolderIdSchema,
  commissionListingIdSchema,
  commissionProposalIdSchema,
  adminDispatchIdSchema,
} from './atoms.js';

// Scoped-media grant request for the gateway Worker (design doc: scoped tier =
// cookie + user-bound grant). This is the CLIENT-CALLED wire contract for the
// `createMediaGrant` callable — it crosses the backend↔frontend boundary, so it
// lives here (callable-validation convention), not locally in the functions repo.
// The EXACT Firestore permission check happens in the callable; this schema only
// pins the shape. A custom folder's bytes must be unreachable outside its view
// trade-professions, so `workFileFolder` is the EXACT folder scope (not the whole
// Work grant); guildChannel / guildInvite are per-channel/thread scopes.
export const CreateMediaGrantInputSchema = z.discriminatedUnion('scopeKind', [
  // Pre-publish content media of a work project (hall covers / sub-item media) —
  // requires project read membership. Work FILES use the tighter workFileFolder scope.
  z.object({
    scopeKind: z.literal('workProject'),
    workProjectId: workProjectIdSchema,
  }).strict(),
  // One work-project FILE FOLDER — the EXACT folder scope, NOT the whole-Work grant.
  z.object({
    scopeKind: z.literal('workFileFolder'),
    workProjectId: workProjectIdSchema,
    workFileFolderId: workFileFolderIdSchema,
  }).strict(),
  // One commission proposal's media — proposal author or listing-side manager.
  z.object({
    scopeKind: z.literal('commissionProposal'),
    commissionListingId: commissionListingIdSchema,
    commissionProposalId: commissionProposalIdSchema,
  }).strict(),
  // A guild-CHANNEL chat attachment — the EXACT channel scope, NOT the whole-Work grant.
  z.object({
    scopeKind: z.literal('guildChannel'),
    workProjectId: workProjectIdSchema,
    guildChatChannelId: guildChatChannelIdSchema,
  }).strict(),
  // A guild-INVITE-thread chat attachment (no workProjectId to match on).
  z.object({
    scopeKind: z.literal('guildInvite'),
    guildInviteId: guildInviteIdSchema,
  }).strict(),
  // An admin-support THREAD chat attachment — per-thread scope keyed by adminDispatchId
  // (thread owner or admin authority; the callable runs the same checks startUpload's
  // adminSupport branch does).
  z.object({
    scopeKind: z.literal('adminSupport'),
    adminDispatchId: adminDispatchIdSchema,
  }).strict(),
]);
export type CreateMediaGrantInput = z.infer<typeof CreateMediaGrantInputSchema>;
