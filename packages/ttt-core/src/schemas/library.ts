import { z } from 'zod';
import {
  projectIdSchema,
  projectTypeSchema,
  taleIdSchema,
  tuneIdSchema,
  televisionIdSchema,
  chapterIdSchema,
  songIdSchema,
  showIdSchema,
  titleSchema,
  addRemoveActionSchema,
  thresholdItemIdSchema,
} from './atoms.js';
import { MAX_LIBRARY_SUBMIT_BATCH } from '../constants/business.js';

export const CreateChapterInputSchema = z.object({
  projectId: projectIdSchema,
  taleId: taleIdSchema,
  title: titleSchema,
}).strict();
export type CreateChapterInput = z.infer<typeof CreateChapterInputSchema>;

export const CreateShowInputSchema = z.object({
  projectId: projectIdSchema,
  televisionId: televisionIdSchema,
  title: titleSchema,
}).strict();
export type CreateShowInput = z.infer<typeof CreateShowInputSchema>;

export const CreateSongInputSchema = z.object({
  projectId: projectIdSchema,
  tuneId: tuneIdSchema,
  title: titleSchema,
}).strict();
export type CreateSongInput = z.infer<typeof CreateSongInputSchema>;

export const ReviewLibraryItemInputSchema = z.object({
  thresholdItemId: thresholdItemIdSchema,
  decision: z.enum(['approved', 'needs_revision']),
  adminNotes: z.string().max(2000).nullable().optional(),
}).strict();
export type ReviewLibraryItemInput = z.infer<typeof ReviewLibraryItemInputSchema>;

export const SubmitForLibraryReviewInputSchema = z.object({
  projectId: projectIdSchema,
  projectType: projectTypeSchema,
  selectedItemIds: z.array(z.string().min(1)).min(1).max(MAX_LIBRARY_SUBMIT_BATCH),
}).strict();
export type SubmitForLibraryReviewInput = z.infer<typeof SubmitForLibraryReviewInputSchema>;

export const UpdateChapterDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  taleId: taleIdSchema,
  chapterId: chapterIdSchema,
  title: titleSchema.optional(),
  content: z.string().max(100000).optional(),
}).strict();
export type UpdateChapterDetailsInput = z.infer<typeof UpdateChapterDetailsInputSchema>;

export const UpdateShowDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  televisionId: televisionIdSchema,
  showId: showIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateShowDetailsInput = z.infer<typeof UpdateShowDetailsInputSchema>;

export const UpdateSongDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  tuneId: tuneIdSchema,
  songId: songIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateSongDetailsInput = z.infer<typeof UpdateSongDetailsInputSchema>;

export const UpdateTaleCategoriesInputSchema = z.object({
  projectId: projectIdSchema,
  taleId: taleIdSchema,
  category: z.string().min(1).max(50),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTaleCategoriesInput = z.infer<typeof UpdateTaleCategoriesInputSchema>;

export const UpdateTaleDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  taleId: taleIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTaleDetailsInput = z.infer<typeof UpdateTaleDetailsInputSchema>;

export const UpdateTelevisionCategoriesInputSchema = z.object({
  projectId: projectIdSchema,
  televisionId: televisionIdSchema,
  category: z.string().min(1).max(50),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTelevisionCategoriesInput = z.infer<typeof UpdateTelevisionCategoriesInputSchema>;

export const UpdateTelevisionDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  televisionId: televisionIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTelevisionDetailsInput = z.infer<typeof UpdateTelevisionDetailsInputSchema>;

export const UpdateTuneCategoriesInputSchema = z.object({
  projectId: projectIdSchema,
  tuneId: tuneIdSchema,
  category: z.string().min(1).max(50),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTuneCategoriesInput = z.infer<typeof UpdateTuneCategoriesInputSchema>;

export const UpdateTuneDetailsInputSchema = z.object({
  projectId: projectIdSchema,
  tuneId: tuneIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTuneDetailsInput = z.infer<typeof UpdateTuneDetailsInputSchema>;
