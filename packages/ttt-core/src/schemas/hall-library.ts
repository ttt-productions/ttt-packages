import { z } from 'zod';
import {
  workProjectIdSchema,
  workProjectTypeSchema,
  taleIdSchema,
  tuneIdSchema,
  televisionIdSchema,
  chapterIdSchema,
  trackIdSchema,
  episodeIdSchema,
  titleSchema,
  addRemoveActionSchema,
  thresholdItemIdSchema,
} from './atoms.js';
import { MAX_HALL_LIBRARY_SUBMIT_BATCH } from '../constants/business.js';

export const CreateChapterInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  title: titleSchema,
}).strict();
export type CreateChapterInput = z.infer<typeof CreateChapterInputSchema>;

export const CreateTelevisionEpisodeInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  title: titleSchema,
}).strict();
export type CreateTelevisionEpisodeInput = z.infer<typeof CreateTelevisionEpisodeInputSchema>;

export const CreateTuneTrackInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  tuneId: tuneIdSchema,
  title: titleSchema,
}).strict();
export type CreateTuneTrackInput = z.infer<typeof CreateTuneTrackInputSchema>;

export const ReviewThresholdItemInputSchema = z.object({
  thresholdItemId: thresholdItemIdSchema,
  decision: z.enum(['approved', 'needs_revision']),
  adminNotes: z.string().max(2000).nullable().optional(),
}).strict();
export type ReviewThresholdItemInput = z.infer<typeof ReviewThresholdItemInputSchema>;

export const SubmitForThresholdLibraryReviewInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workProjectType: workProjectTypeSchema,
  selectedItemIds: z.array(z.string().min(1)).min(1).max(MAX_HALL_LIBRARY_SUBMIT_BATCH),
}).strict();
export type SubmitForThresholdLibraryReviewInput = z.infer<typeof SubmitForThresholdLibraryReviewInputSchema>;

export const UpdateChapterDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  chapterId: chapterIdSchema,
  title: titleSchema.optional(),
  content: z.string().max(100000).optional(),
}).strict();
export type UpdateChapterDetailsInput = z.infer<typeof UpdateChapterDetailsInputSchema>;

export const UpdateTelevisionEpisodeDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  episodeId: episodeIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTelevisionEpisodeDetailsInput = z.infer<typeof UpdateTelevisionEpisodeDetailsInputSchema>;

export const UpdateTuneTrackDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  tuneId: tuneIdSchema,
  trackId: trackIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTuneTrackDetailsInput = z.infer<typeof UpdateTuneTrackDetailsInputSchema>;

export const UpdateTaleCategoriesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  category: z.string().min(1).max(50),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTaleCategoriesInput = z.infer<typeof UpdateTaleCategoriesInputSchema>;

export const UpdateTaleDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTaleDetailsInput = z.infer<typeof UpdateTaleDetailsInputSchema>;

export const UpdateTelevisionCategoriesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  category: z.string().min(1).max(50),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTelevisionCategoriesInput = z.infer<typeof UpdateTelevisionCategoriesInputSchema>;

export const UpdateTelevisionDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTelevisionDetailsInput = z.infer<typeof UpdateTelevisionDetailsInputSchema>;

export const UpdateTuneCategoriesInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  tuneId: tuneIdSchema,
  category: z.string().min(1).max(50),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTuneCategoriesInput = z.infer<typeof UpdateTuneCategoriesInputSchema>;

export const UpdateTuneDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  tuneId: tuneIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTuneDetailsInput = z.infer<typeof UpdateTuneDetailsInputSchema>;



