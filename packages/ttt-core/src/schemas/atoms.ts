import { z } from 'zod';

// ID atoms — every callable input that includes an ID field uses one of these.
// Kept as separate constants (not aliases of a generic `idSchema`) so consumers
// reading a callable's schema can see exactly which entity the field refers to.
export const projectIdSchema = z.string().min(1);
export const userIdSchema = z.string().min(1);
export const inviteIdSchema = z.string().min(1);
export const violationIdSchema = z.string().min(1);
export const opportunityIdSchema = z.string().min(1);
export const jobIdSchema = z.string().min(1);
export const replyIdSchema = z.string().min(1);
export const channelIdSchema = z.string().min(1);
export const taleIdSchema = z.string().min(1);
export const tuneIdSchema = z.string().min(1);
export const televisionIdSchema = z.string().min(1);
export const chapterIdSchema = z.string().min(1);
export const songIdSchema = z.string().min(1);
export const showIdSchema = z.string().min(1);
export const skillIdSchema = z.string().min(1);
export const taskIdSchema = z.string().min(1);
export const messageIdSchema = z.string().min(1);
export const libraryIdSchema = z.string().min(1);
export const itemIdSchema = z.string().min(1);
export const thresholdItemIdSchema = z.string().min(1);

// Action / enum atoms.
export const addRemoveActionSchema = z.enum(['add', 'remove']);
export const projectTypeSchema = z.enum(['Tales', 'Tunes', 'Television']);

// String shape atoms.
export const titleSchema = z.string().min(1).max(200);
