import { z } from 'zod';

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
export const taleIdSchema = z.string().min(1);
export const tuneIdSchema = z.string().min(1);
export const televisionIdSchema = z.string().min(1);
export const chapterIdSchema = z.string().min(1);
export const trackIdSchema = z.string().min(1);
export const episodeIdSchema = z.string().min(1);
export const craftSkillIdSchema = z.string().min(1);
export const taskIdSchema = z.string().min(1);
export const adminDispatchIdSchema = z.string().min(1);
export const hallItemIdSchema = z.string().min(1);
export const itemIdSchema = z.string().min(1);
export const thresholdItemIdSchema = z.string().min(1);

// Action / enum atoms.
export const addRemoveActionSchema = z.enum(['add', 'remove']);
export const workProjectTypeSchema = z.enum(['Tales', 'Tunes', 'Television']);

// String shape atoms.
export const titleSchema = z.string().min(1).max(200);


