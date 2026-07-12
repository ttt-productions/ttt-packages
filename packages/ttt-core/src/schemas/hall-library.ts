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
  hallItemIdSchema,
  itemIdSchema,
  changeRequestIdSchema,
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
  // Optional here so a `needs_revision` decision still validates; the callable REQUIRES all
  // true on an `approved` decision. First two: no-begging-for-bouquets, no-credits-in-content.
  confirmedNoBegging: z.boolean().optional(),
  confirmedNoCredits: z.boolean().optional(),
  // Reviewer verified the AUTHOR's real-people/parody attestation sits in the correct
  // position for the content they reviewed — checked if the work depicts real people,
  // unchecked if it does not (R3, DJ 2026-07-12). A wrong position is a needs-revision
  // send-back, never an admin edit.
  confirmedRealPeopleAttestation: z.boolean().optional(),
}).strict();
export type ReviewThresholdItemInput = z.infer<typeof ReviewThresholdItemInputSchema>;

export const SubmitForThresholdLibraryReviewInputSchema = z.object({
  workProjectId: workProjectIdSchema,
  workProjectType: workProjectTypeSchema,
  selectedItemIds: z.array(z.string().min(1)).min(1).max(MAX_HALL_LIBRARY_SUBMIT_BATCH),
  // AUTHOR attestation (R3, 2026-07-12): the submitting artisan attests this work
  // depicts real people (parody / satire / commentary). Stored on the threshold
  // item as `hasRealPeople`; the reviewer sees it READ-ONLY. When true, published
  // surfaces render the ONE standard platform disclaimer
  // (REAL_PEOPLE_DISCLAIMER_MESSAGE) — no free-text disclaimer input exists.
  depictsRealPeople: z.boolean(),
}).strict();
export type SubmitForThresholdLibraryReviewInput = z.infer<typeof SubmitForThresholdLibraryReviewInputSchema>;

// Member-initiated pull-back of a still-pending threshold submission. The runner derives
// everything else from the threshold doc; rejects unless reviewStatus === 'pending'.
export const WithdrawFromThresholdLibraryReviewInputSchema = z.object({
  thresholdItemId: thresholdItemIdSchema,
}).strict();
export type WithdrawFromThresholdLibraryReviewInput = z.infer<typeof WithdrawFromThresholdLibraryReviewInputSchema>;

// Published change request (text-only at launch): the member proposes new values for TEXT
// fields on a PUBLISHED surface — one pipeline, three grains (R1, 2026-07-12):
//  - hall grains: `hallItemId` set (+ `workProjectType`); the hall parent detail when
//    `subItemId` is absent, else the chapter/track/episode sub-item.
//  - realm grain: `workRealmId` set; targets the `workRealms/{id}` doc once the realm
//    counts as published. `workProjectType`/`subItemId` do not apply.
// Exactly one of `hallItemId` / `workRealmId` must be set. Field names are validated by
// the runner against the per-surface HALL_CONTENT_TEXT_FIELDS allowlist +
// HALL_CONTENT_TEXT_FIELD_MAX caps; the schema-level 100000 cap is the largest field cap
// anywhere (chapter content).
export const SubmitHallContentChangeRequestInputSchema = z.object({
  hallItemId: hallItemIdSchema.nullish(),
  workProjectType: workProjectTypeSchema.nullish(),
  workRealmId: z.string().min(1).nullish(),
  subItemId: z.string().min(1).nullish(),
  proposedFields: z.record(z.string().min(1).max(64), z.string().trim().min(1).max(100000))
    .refine((fields) => Object.keys(fields).length > 0, { message: 'Propose at least one field change.' }),
}).strict().superRefine((val, ctx) => {
  const hasHallItem = typeof val.hallItemId === 'string' && val.hallItemId.length > 0;
  const hasRealm = typeof val.workRealmId === 'string' && val.workRealmId.length > 0;
  if (hasHallItem === hasRealm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of hallItemId or workRealmId.',
      path: [hasRealm ? 'workRealmId' : 'hallItemId'],
    });
    return;
  }
  if (hasHallItem && (val.workProjectType === null || val.workProjectType === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'workProjectType is required for a hall-item change request.',
      path: ['workProjectType'],
    });
  }
  if (hasRealm && (val.workProjectType !== null && val.workProjectType !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'workProjectType does not apply to a realm change request.',
      path: ['workProjectType'],
    });
  }
  if (hasRealm && typeof val.subItemId === 'string' && val.subItemId.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'subItemId does not apply to a realm change request.',
      path: ['subItemId'],
    });
  }
});
export type SubmitHallContentChangeRequestInput = z.infer<typeof SubmitHallContentChangeRequestInputSchema>;

// Admin decision on a published change request. `resolutionReason` is REQUIRED on a deny
// (the member is shown why); optional note on approve.
export const ReviewHallContentChangeRequestInputSchema = z.object({
  changeRequestId: changeRequestIdSchema,
  decision: z.enum(['approved', 'denied']),
  resolutionReason: z.string().trim().max(2000).optional(),
}).strict().superRefine((val, ctx) => {
  if (val.decision === 'denied' && (!val.resolutionReason || val.resolutionReason.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A reason is required when denying a change request.', path: ['resolutionReason'] });
  }
});
export type ReviewHallContentChangeRequestInput = z.infer<typeof ReviewHallContentChangeRequestInputSchema>;

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

// --- Per-user Hall viewing-state doc (hall-viewing-experience Area 2, ruled 2026-07-04) ---
// One core (`runX`) owns the single privateData doc per Rule 3; writes are CALLABLE-ONLY —
// no direct client Firestore writes anywhere in this system. Every list on the doc is capped
// (HALL_LIBRARY_PREFS_CAPS in ../constants/business.js); cap enforcement is the backend
// core's job, not this input-validation layer.

export const UpdateHallWorkHiddenInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  hidden: z.boolean(),
}).strict();
export type UpdateHallWorkHiddenInput = z.infer<typeof UpdateHallWorkHiddenInputSchema>;

// "Inked" save-for-later watchlist toggle (My Playbill Area 7) — deliberately separate from
// follows (Inked is private organization; follow is semi-public with a counter + notifications).
export const UpdateHallInkedWorkInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  inked: z.boolean(),
}).strict();
export type UpdateHallInkedWorkInput = z.infer<typeof UpdateHallInkedWorkInputSchema>;

// Playback-progress heartbeat (throttled client-side to ~60s during playback, plus writes on
// pause / pane-exit / media-end). `durationSeconds` is optional — not always known up front.
export const UpdateHallPlaybackProgressInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  itemId: itemIdSchema,
  positionSeconds: z.number().min(0),
  durationSeconds: z.number().min(0).optional(),
}).strict();
export type UpdateHallPlaybackProgressInput = z.infer<typeof UpdateHallPlaybackProgressInputSchema>;

// Recently-viewed / History rail record. `itemId` is optional — a work-level view (no
// sub-item selected yet) still records History.
export const UpdateHallRecentlyViewedInputSchema = z.object({
  hallItemId: hallItemIdSchema,
  itemId: itemIdSchema.nullish(),
}).strict();
export type UpdateHallRecentlyViewedInput = z.infer<typeof UpdateHallRecentlyViewedInputSchema>;

export const UpdateHallLibrarySettingsInputSchema = z.object({
  tunesAutoplay: z.boolean(),
}).strict();
export type UpdateHallLibrarySettingsInput = z.infer<typeof UpdateHallLibrarySettingsInputSchema>;


