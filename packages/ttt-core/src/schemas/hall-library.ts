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
  addRemoveActionSchema,
  thresholdItemIdSchema,
  hallItemIdSchema,
  itemIdSchema,
  changeRequestIdSchema,
  LegalReviewNoticeAcknowledgedInputSchema,
  hallSubItemIdSchema,
  workRealmIdSchema,
} from './atoms.js';
import { MAX_HALL_LIBRARY_SUBMIT_BATCH } from '../constants/business-admin.js';
import { PUBLISH_ATTESTATIONS_VERSION } from '../constants/publish-attestations.js';
import {
  CHAPTER_CONTENT_INPUT,
  CHAPTER_TITLE_INPUT,
  HALL_CHANGE_REQUEST_DENY_REASON_INPUT,
  HALL_CONTENT_CHANGE_REQUEST_INPUTS,
  TELEVISION_EPISODE_DESCRIPTION_INPUT,
  TELEVISION_EPISODE_TITLE_INPUT,
  THRESHOLD_REVIEW_NOTES_INPUT,
  TUNE_TRACK_DESCRIPTION_INPUT,
  TUNE_TRACK_TITLE_INPUT,
} from '../constants/text-fields.js';
import { WORK_PROJECT_SPECIFIC_GENRES } from '../constants/options.js';
import { textFieldSchema } from './text-field.js';

const TALE_GENRE_VALUES = WORK_PROJECT_SPECIFIC_GENRES.Tales as unknown as [string, ...string[]];
const TUNE_GENRE_VALUES = WORK_PROJECT_SPECIFIC_GENRES.Tunes as unknown as [string, ...string[]];
const TELEVISION_GENRE_VALUES = WORK_PROJECT_SPECIFIC_GENRES.Television as unknown as [
  string,
  ...string[],
];

export const CreateChapterInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    taleId: taleIdSchema,
    title: textFieldSchema(CHAPTER_TITLE_INPUT),
  })
  .strict();
export type CreateChapterInput = z.infer<typeof CreateChapterInputSchema>;

export const CreateChapterResultSchema = z.object({
  success: z.literal(true),
  chapterId: chapterIdSchema,
  order: z.number().int(),
});
export type CreateChapterResult = z.infer<typeof CreateChapterResultSchema>;

export const CreateTelevisionEpisodeInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    televisionId: televisionIdSchema,
    title: textFieldSchema(TELEVISION_EPISODE_TITLE_INPUT),
  })
  .strict();
export type CreateTelevisionEpisodeInput = z.infer<typeof CreateTelevisionEpisodeInputSchema>;

export const CreateTelevisionEpisodeResultSchema = z.object({
  success: z.literal(true),
  episodeId: episodeIdSchema,
  order: z.number().int(),
});
export type CreateTelevisionEpisodeResult = z.infer<typeof CreateTelevisionEpisodeResultSchema>;

export const CreateTuneTrackInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    tuneId: tuneIdSchema,
    title: textFieldSchema(TUNE_TRACK_TITLE_INPUT),
  })
  .strict();
export type CreateTuneTrackInput = z.infer<typeof CreateTuneTrackInputSchema>;

export const CreateTuneTrackResultSchema = z.object({
  success: z.literal(true),
  trackId: trackIdSchema,
  order: z.number().int(),
});
export type CreateTuneTrackResult = z.infer<typeof CreateTuneTrackResultSchema>;

// Nullish: the Firebase callable client sends an omitted argument as null.
export const ReviewThresholdItemInputSchema = z
  .object({
    thresholdItemId: thresholdItemIdSchema,
    decision: z.enum(['approved', 'needs_revision']),
    adminNotes: textFieldSchema(THRESHOLD_REVIEW_NOTES_INPUT).nullable().optional(),
    confirmedNoBegging: z.boolean().nullish(),
    confirmedNoCredits: z.boolean().nullish(),
    confirmedRealPeopleAttestation: z.boolean().nullish(),
    teachesSomething: z.boolean().nullish(),
    confirmedConsistentFormat: z.boolean().nullish(),
  })
  .strict();
export type ReviewThresholdItemInput = z.infer<typeof ReviewThresholdItemInputSchema>;

export const ReviewThresholdItemResultSchema = z.object({
  success: z.literal(true),
  hallItemId: hallItemIdSchema,
  thresholdItemId: thresholdItemIdSchema,
  itemId: itemIdSchema,
  decision: z.enum(['approved', 'needs_revision']),
});
export type ReviewThresholdItemResult = z.infer<typeof ReviewThresholdItemResultSchema>;

export const SubmitForThresholdLibraryReviewInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    workProjectType: workProjectTypeSchema,
    selectedItemIds: z.array(hallSubItemIdSchema).min(1).max(MAX_HALL_LIBRARY_SUBMIT_BATCH),
    depictsRealPeople: z.boolean(),
    legalReviewNoticeAcknowledged: LegalReviewNoticeAcknowledgedInputSchema,
    attestConsistentFormat: z.boolean().nullish(),
    attestNoCredits: z.boolean().nullish(),
    attestNoBegging: z.boolean().nullish(),
    attestHumanMadeOriginal: z.boolean().nullish(),
    attestPublishStewardship: z.boolean().nullish(),
    attestationsVersion: z.literal(PUBLISH_ATTESTATIONS_VERSION).nullish(),
  })
  .strict();
export type SubmitForThresholdLibraryReviewInput = z.infer<
  typeof SubmitForThresholdLibraryReviewInputSchema
>;

export const SubmitForThresholdLibraryReviewResultSchema = z.object({
  success: z.literal(true),
  hallItemId: hallItemIdSchema,
  thresholdItemIds: z.array(thresholdItemIdSchema),
});
export type SubmitForThresholdLibraryReviewResult = z.infer<
  typeof SubmitForThresholdLibraryReviewResultSchema
>;

export const WithdrawFromThresholdLibraryReviewInputSchema = z
  .object({
    thresholdItemId: thresholdItemIdSchema,
  })
  .strict();
export type WithdrawFromThresholdLibraryReviewInput = z.infer<
  typeof WithdrawFromThresholdLibraryReviewInputSchema
>;

export const WithdrawFromThresholdLibraryReviewResultSchema = z.object({
  success: z.literal(true),
  hallItemId: hallItemIdSchema,
  thresholdItemId: thresholdItemIdSchema,
  itemId: itemIdSchema,
});
export type WithdrawFromThresholdLibraryReviewResult = z.infer<
  typeof WithdrawFromThresholdLibraryReviewResultSchema
>;

const MAX_PROPOSED_TEXT_LENGTH = Math.max(
  ...Object.values(HALL_CONTENT_CHANGE_REQUEST_INPUTS).flatMap((fields) =>
    Object.values(fields).map((declaration) => declaration.max),
  ),
);

export const SubmitHallContentChangeRequestInputSchema = z
  .object({
    hallItemId: hallItemIdSchema.nullish(),
    workProjectType: workProjectTypeSchema.nullish(),
    workRealmId: workRealmIdSchema.nullish(),
    subItemId: hallSubItemIdSchema.nullish(),
    proposedFields: z
      .record(
        z.string().min(1).max(64),
        z.string().refine((value) => value.trim().length <= MAX_PROPOSED_TEXT_LENGTH),
      )
      .refine((fields) => Object.keys(fields).length > 0, {
        message: 'Propose at least one field change.',
      }),
  })
  .strict()
  .superRefine((val, ctx) => {
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
    if (hasRealm && val.workProjectType !== null && val.workProjectType !== undefined) {
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
export type SubmitHallContentChangeRequestInput = z.infer<
  typeof SubmitHallContentChangeRequestInputSchema
>;

export const SubmitHallContentChangeRequestResultSchema = z.object({
  success: z.literal(true),
  changeRequestId: changeRequestIdSchema,
});
export type SubmitHallContentChangeRequestResult = z.infer<
  typeof SubmitHallContentChangeRequestResultSchema
>;

export const ReviewHallContentChangeRequestInputSchema = z
  .object({
    changeRequestId: changeRequestIdSchema,
    decision: z.enum(['approved', 'denied']),
    resolutionReason: textFieldSchema(HALL_CHANGE_REQUEST_DENY_REASON_INPUT).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.decision === 'denied' && (!val.resolutionReason || val.resolutionReason.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A reason is required when denying a change request.',
        path: ['resolutionReason'],
      });
    }
  });
export type ReviewHallContentChangeRequestInput = z.infer<
  typeof ReviewHallContentChangeRequestInputSchema
>;

export const ReviewHallContentChangeRequestResultSchema = z.object({
  success: z.literal(true),
  changeRequestId: changeRequestIdSchema,
  decision: z.enum(['approved', 'denied']),
});
export type ReviewHallContentChangeRequestResult = z.infer<
  typeof ReviewHallContentChangeRequestResultSchema
>;

export const UpdateChapterDetailsInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    taleId: taleIdSchema,
    chapterId: chapterIdSchema,
    title: textFieldSchema(CHAPTER_TITLE_INPUT).optional(),
    content: textFieldSchema(CHAPTER_CONTENT_INPUT).optional(),
  })
  .strict();
export type UpdateChapterDetailsInput = z.infer<typeof UpdateChapterDetailsInputSchema>;

export const UpdateChapterDetailsResultSchema = z.object({
  success: z.literal(true),
  chapterId: chapterIdSchema,
});
export type UpdateChapterDetailsResult = z.infer<typeof UpdateChapterDetailsResultSchema>;

export const UpdateTelevisionEpisodeDetailsInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    televisionId: televisionIdSchema,
    episodeId: episodeIdSchema,
    title: textFieldSchema(TELEVISION_EPISODE_TITLE_INPUT).optional(),
    description: textFieldSchema(TELEVISION_EPISODE_DESCRIPTION_INPUT).optional(),
  })
  .strict();
export type UpdateTelevisionEpisodeDetailsInput = z.infer<
  typeof UpdateTelevisionEpisodeDetailsInputSchema
>;

export const UpdateTelevisionEpisodeDetailsResultSchema = z.object({
  success: z.literal(true),
  episodeId: episodeIdSchema,
});
export type UpdateTelevisionEpisodeDetailsResult = z.infer<
  typeof UpdateTelevisionEpisodeDetailsResultSchema
>;

export const UpdateTuneTrackDetailsInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    tuneId: tuneIdSchema,
    trackId: trackIdSchema,
    title: textFieldSchema(TUNE_TRACK_TITLE_INPUT).optional(),
    description: textFieldSchema(TUNE_TRACK_DESCRIPTION_INPUT).optional(),
  })
  .strict();
export type UpdateTuneTrackDetailsInput = z.infer<typeof UpdateTuneTrackDetailsInputSchema>;

export const UpdateTuneTrackDetailsResultSchema = z.object({
  success: z.literal(true),
  trackId: trackIdSchema,
});
export type UpdateTuneTrackDetailsResult = z.infer<typeof UpdateTuneTrackDetailsResultSchema>;

export const UpdateTaleWorkGenresInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    taleId: taleIdSchema,
    workGenre: z.enum(TALE_GENRE_VALUES),
    action: addRemoveActionSchema,
  })
  .strict();
export type UpdateTaleWorkGenresInput = z.infer<typeof UpdateTaleWorkGenresInputSchema>;

export const UpdateTaleWorkGenresResultSchema = z.object({
  success: z.literal(true),
  taleId: taleIdSchema,
});
export type UpdateTaleWorkGenresResult = z.infer<typeof UpdateTaleWorkGenresResultSchema>;

export const UpdateTelevisionWorkGenresInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    televisionId: televisionIdSchema,
    workGenre: z.enum(TELEVISION_GENRE_VALUES),
    action: addRemoveActionSchema,
  })
  .strict();
export type UpdateTelevisionWorkGenresInput = z.infer<typeof UpdateTelevisionWorkGenresInputSchema>;

export const UpdateTelevisionWorkGenresResultSchema = z.object({
  success: z.literal(true),
  televisionId: televisionIdSchema,
});
export type UpdateTelevisionWorkGenresResult = z.infer<
  typeof UpdateTelevisionWorkGenresResultSchema
>;

export const UpdateTuneWorkGenresInputSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    tuneId: tuneIdSchema,
    workGenre: z.enum(TUNE_GENRE_VALUES),
    action: addRemoveActionSchema,
  })
  .strict();
export type UpdateTuneWorkGenresInput = z.infer<typeof UpdateTuneWorkGenresInputSchema>;

export const UpdateTuneWorkGenresResultSchema = z.object({
  success: z.literal(true),
  tuneId: tuneIdSchema,
});
export type UpdateTuneWorkGenresResult = z.infer<typeof UpdateTuneWorkGenresResultSchema>;

export const UpdateHallWorkHiddenInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    hidden: z.boolean(),
  })
  .strict();
export type UpdateHallWorkHiddenInput = z.infer<typeof UpdateHallWorkHiddenInputSchema>;

export const UpdateHallWorkHiddenResultSchema = z.object({
  success: z.literal(true),
  hidden: z.boolean(),
  idempotent: z.boolean(),
});
export type UpdateHallWorkHiddenResult = z.infer<typeof UpdateHallWorkHiddenResultSchema>;

export const UpdateHallInkedWorkInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    inked: z.boolean(),
  })
  .strict();
export type UpdateHallInkedWorkInput = z.infer<typeof UpdateHallInkedWorkInputSchema>;

export const UpdateHallInkedWorkResultSchema = z.object({
  success: z.literal(true),
  inked: z.boolean(),
  idempotent: z.boolean(),
});
export type UpdateHallInkedWorkResult = z.infer<typeof UpdateHallInkedWorkResultSchema>;

export const UpdateHallPlaybackProgressInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    itemId: itemIdSchema,
    positionSeconds: z.number().min(0),
    durationSeconds: z.number().min(0).optional(),
  })
  .strict();
export type UpdateHallPlaybackProgressInput = z.infer<typeof UpdateHallPlaybackProgressInputSchema>;

export const UpdateHallPlaybackProgressResultSchema = z.object({
  success: z.literal(true),
  hallItemId: hallItemIdSchema,
});
export type UpdateHallPlaybackProgressResult = z.infer<
  typeof UpdateHallPlaybackProgressResultSchema
>;

export const UpdateHallRecentlyViewedInputSchema = z
  .object({
    hallItemId: hallItemIdSchema,
    itemId: itemIdSchema.nullish(),
  })
  .strict();
export type UpdateHallRecentlyViewedInput = z.infer<typeof UpdateHallRecentlyViewedInputSchema>;

export const UpdateHallRecentlyViewedResultSchema = z.object({
  success: z.literal(true),
  hallItemId: hallItemIdSchema,
});
export type UpdateHallRecentlyViewedResult = z.infer<typeof UpdateHallRecentlyViewedResultSchema>;

export const UpdateHallLibrarySettingsInputSchema = z
  .object({
    tunesAutoplay: z.boolean(),
  })
  .strict();
export type UpdateHallLibrarySettingsInput = z.infer<typeof UpdateHallLibrarySettingsInputSchema>;

export const UpdateHallLibrarySettingsResultSchema = z.object({
  success: z.literal(true),
  settings: z.object({ tunesAutoplay: z.boolean() }),
});
export type UpdateHallLibrarySettingsResult = z.infer<typeof UpdateHallLibrarySettingsResultSchema>;
