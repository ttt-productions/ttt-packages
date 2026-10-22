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

const WorkProjectGrantScopeSchema = z
  .object({
    scopeKind: z.literal('workProject'),
    workProjectId: workProjectIdSchema,
  })
  .strict();

const WorkFileFolderGrantScopeSchema = z
  .object({
    scopeKind: z.literal('workFileFolder'),
    workProjectId: workProjectIdSchema,
    workFileFolderId: workFileFolderIdSchema,
  })
  .strict();

const CommissionProposalGrantScopeSchema = z
  .object({
    scopeKind: z.literal('commissionProposal'),
    commissionListingId: commissionListingIdSchema,
    commissionProposalId: commissionProposalIdSchema,
  })
  .strict();

const GuildInviteGrantScopeSchema = z
  .object({
    scopeKind: z.literal('guildInvite'),
    guildInviteId: guildInviteIdSchema,
  })
  .strict();

const AdminSupportGrantScopeSchema = z
  .object({
    scopeKind: z.literal('adminSupport'),
    adminDispatchId: adminDispatchIdSchema,
  })
  .strict();

const AdminReviewGrantScopeSchema = z
  .object({
    scopeKind: z.literal('adminReview'),
    reportGroupId: reportGroupIdSchema,
    mediaAssetId: mediaAssetIdSchema,
  })
  .strict();

const RealmFilePreviewGrantScopeSchema = z
  .object({
    scopeKind: z.literal('realmFilePreview'),
    workRealmId: workRealmIdSchema,
    mediaAssetId: mediaAssetIdSchema,
    realmFileShareRequestId: realmFileShareRequestIdSchema,
  })
  .strict();

export const CreateMediaGrantInputSchema = z.discriminatedUnion('scopeKind', [
  WorkProjectGrantScopeSchema,
  WorkFileFolderGrantScopeSchema,
  CommissionProposalGrantScopeSchema,
  GuildInviteGrantScopeSchema,
  AdminSupportGrantScopeSchema,
  RealmFilePreviewGrantScopeSchema,
]);
export type CreateMediaGrantInput = z.infer<typeof CreateMediaGrantInputSchema>;

export const AdminCreateMediaGrantInputSchema = z.discriminatedUnion('scopeKind', [
  WorkProjectGrantScopeSchema,
  AdminSupportGrantScopeSchema,
  AdminReviewGrantScopeSchema,
]);
export type AdminCreateMediaGrantInput = z.infer<typeof AdminCreateMediaGrantInputSchema>;

export const CreateMediaGrantResultSchema = z
  .object({
    grant: z.string().min(1),
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type CreateMediaGrantResult = z.infer<typeof CreateMediaGrantResultSchema>;
