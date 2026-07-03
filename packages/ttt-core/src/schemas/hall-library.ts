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
import { WORK_PROJECT_SPECIFIC_GENRES } from '../constants/options.js';

// Canonical per-type genre enums. `WORK_PROJECT_SPECIFIC_GENRES.<type>` is a readonly
// tuple of the exact genre strings the UI offers; the schema is the cross-boundary
// contract, so a crafted callable can no longer put arbitrary/unmoderated text (or an
// unbounded array of distinct strings) onto the public hall parent.
const TALE_GENRE_VALUES = WORK_PROJECT_SPECIFIC_GENRES.Tales as unknown as [string, ...string[]];
const TUNE_GENRE_VALUES = WORK_PROJECT_SPECIFIC_GENRES.Tunes as unknown as [string, ...string[]];
const TELEVISION_GENRE_VALUES = WORK_PROJECT_SPECIFIC_GENRES.Television as unknown as [string, ...string[]];

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
  // Reviewer checklist confirmations, recorded on the review (mirrors `teachesSomething`).
  // Optional here so a `needs_revision` decision still validates; the callable REQUIRES both
  // true on an `approved` decision. First two: no-begging-for-bouquets, no-credits-in-content.
  confirmedNoBegging: z.boolean().optional(),
  confirmedNoCredits: z.boolean().optional(),
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

export const UpdateTaleWorkGenresInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  workGenre: z.enum(TALE_GENRE_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTaleWorkGenresInput = z.infer<typeof UpdateTaleWorkGenresInputSchema>;

export const UpdateTaleDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  taleId: taleIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTaleDetailsInput = z.infer<typeof UpdateTaleDetailsInputSchema>;

export const UpdateTelevisionWorkGenresInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  workGenre: z.enum(TELEVISION_GENRE_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTelevisionWorkGenresInput = z.infer<typeof UpdateTelevisionWorkGenresInputSchema>;

export const UpdateTelevisionDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  televisionId: televisionIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTelevisionDetailsInput = z.infer<typeof UpdateTelevisionDetailsInputSchema>;

export const UpdateTuneWorkGenresInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  tuneId: tuneIdSchema,
  workGenre: z.enum(TUNE_GENRE_VALUES),
  action: addRemoveActionSchema,
}).strict();
export type UpdateTuneWorkGenresInput = z.infer<typeof UpdateTuneWorkGenresInputSchema>;

export const UpdateTuneDetailsInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  tuneId: tuneIdSchema,
  title: titleSchema.optional(),
  description: z.string().max(5000).optional(),
}).strict();
export type UpdateTuneDetailsInput = z.infer<typeof UpdateTuneDetailsInputSchema>;



