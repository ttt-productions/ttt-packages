import { z } from 'zod';
import { MAX_WORK_PROJECT_TITLE_LENGTH } from '../constants/business.js';

// ID atoms — every callable input that includes an ID field uses one of these.
// Kept as separate constants (not aliases of a generic `idSchema`) so consumers
// reading a callable's schema can see exactly which entity the field refers to.
export const workProjectIdSchema = z.string().min(1);
export const userIdSchema = z.string().min(1);
export const guildInviteIdSchema = z.string().min(1);
export const violationIdSchema = z.string().min(1);
export const auditionIdSchema = z.string().min(1);
export const commissionListingIdSchema = z.string().min(1);
export const commissionProposalIdSchema = z.string().min(1);
export const auditionEntryIdSchema = z.string().min(1);
export const guildChatChannelIdSchema = z.string().min(1);
export const workFileFolderIdSchema = z.string().min(1);
export const notificationFanoutJobIdSchema = z.string().min(1);
export const taleIdSchema = z.string().min(1);
export const tuneIdSchema = z.string().min(1);
export const televisionIdSchema = z.string().min(1);
export const chapterIdSchema = z.string().min(1);
export const trackIdSchema = z.string().min(1);
export const episodeIdSchema = z.string().min(1);
export const craftSkillIdSchema = z.string().min(1);
export const taskIdSchema = z.string().min(1);
export const adminDispatchIdSchema = z.string().min(1);
export const reportGroupIdSchema = z.string().min(1);
export const mediaAssetIdSchema = z.string().min(1);
export const hallItemIdSchema = z.string().min(1);
export const itemIdSchema = z.string().min(1);
export const thresholdItemIdSchema = z.string().min(1);
export const changeRequestIdSchema = z.string().min(1);

// Action / enum atoms.
export const addRemoveActionSchema = z.enum(['add', 'remove']);
export const workProjectTypeSchema = z.enum(['Tales', 'Tunes', 'Television']);
export const hallWingTypeSchema = z.enum(['entertainment', 'educational', 'newsPolitical']);

// String shape atoms. Length derives from the owning constant — every title alias
// (tale/tune/tv/chapter/track/episode/commission) resolves to the same value, so the
// UI counter, the Save guard, and this server bound are provably the same rule.
export const titleSchema = z.string().min(1).max(MAX_WORK_PROJECT_TITLE_LENGTH);


