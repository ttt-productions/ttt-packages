import { z } from 'zod';
import { AuditionModeSchema } from '../doc-schemas/commissions.js';
import { MediaTypeSchema } from '../doc-schemas/social.js';
import {
  CraftSkillKindSchema,
  CraftSkillAttestationSchema,
  CraftSkillSourceReferenceSchema,
  CRAFT_SKILL_KIND_REQUIRING_SOURCE,
  type CraftSkillKind,
  type CraftSkillAttestation,
  type CraftSkillSourceReference,
} from '../doc-schemas/user.js';
import {
  workProjectIdSchema,
  commissionListingIdSchema,
  auditionIdSchema,
  itemIdSchema,
  workRealmIdSchema,
  taleIdSchema,
  chapterIdSchema,
  tuneIdSchema,
  trackIdSchema,
  televisionIdSchema,
  episodeIdSchema,
  workFileFolderIdSchema,
  stakeSharesOfferedSchema,
} from '../schemas/atoms.js';
import { textFieldSchema } from '../schemas/text-field.js';
import type { FileOrigin } from './file-origin.js';
import { ConversationFileRefSchema } from './conversation-file-ref.js';
import { SquareStreetzPostMentionsSchema } from './atoms.js';
import {
  TRADE_PROFESSION_OPTIONS,
  TRADE_PROFESSION_VALUES,
  CRAFT_SKILL_TAG_VALUES,
} from '../constants/options.js';
import { CRAFT_SKILL_STATEMENT_VERSION } from '../constants/craft-skill-statements.js';
import { HALL_CONTENT_DETAIL_SURFACES } from '../constants/hall-content-routing.js';
import {
  AuditionDeadlineSchema,
  refineAuditionDeadlineOrder,
} from '../constants/audition-deadlines.js';
import {
  MAX_SPONSORED_AUDITION_AMOUNT_USD,
  MIN_CURATED_AUDITION_OPTIONS,
  MAX_CURATED_AUDITION_OPTIONS,
} from '../constants/business-content.js';
import { MAX_CRAFT_SKILL_TAGS } from '../constants/business-user.js';
import {
  AUDITION_DESCRIPTION_INPUT,
  AUDITION_TITLE_INPUT,
  COMMISSION_COVER_LETTER_INPUT,
  COMMISSION_DESCRIPTION_INPUT,
  COMMISSION_TITLE_INPUT,
} from '../constants/text-fields.js';
import { SystemVideoSlotIdSchema } from '../system-slots/system-slots.js';

export const ProfilePictureTargetInfoSchema = z.object({}).strict();

const craftSkillUploadAttestationShape = {
  kind: CraftSkillKindSchema,
  attestation: CraftSkillAttestationSchema,
  source: CraftSkillSourceReferenceSchema.optional(),
  tags: z
    .array(z.enum(CRAFT_SKILL_TAG_VALUES))
    .min(1, 'Select at least one tag for your craft.')
    .max(MAX_CRAFT_SKILL_TAGS)
    .refine((t) => new Set(t).size === t.length, 'Duplicate tags are not allowed.'),
};

function refineCraftSkillUploadAttestation(
  val: {
    kind: CraftSkillKind;
    attestation: CraftSkillAttestation;
    source?: CraftSkillSourceReference;
  },
  ctx: z.RefinementCtx,
): void {
  if (val.attestation.statementKind !== val.kind) {
    ctx.addIssue({
      code: 'custom',
      message: 'attestation.statementKind must match kind',
      path: ['attestation', 'statementKind'],
    });
  }
  if (val.attestation.statementVersion !== CRAFT_SKILL_STATEMENT_VERSION) {
    ctx.addIssue({
      code: 'custom',
      message: `attestation.statementVersion must be ${CRAFT_SKILL_STATEMENT_VERSION}`,
      path: ['attestation', 'statementVersion'],
    });
  }
  const needsSource = val.kind === CRAFT_SKILL_KIND_REQUIRING_SOURCE;
  if (needsSource && !val.source) {
    ctx.addIssue({
      code: 'custom',
      message: 'A source link (user or work project) is required for a TTT mimic',
      path: ['source'],
    });
  }
  if (!needsSource && val.source) {
    ctx.addIssue({
      code: 'custom',
      message: 'A source link is only allowed for a TTT mimic',
      path: ['source'],
    });
  }
}

export const CraftSkillUploadAttestationSchema = z
  .object(craftSkillUploadAttestationShape)
  .strict()
  .superRefine(refineCraftSkillUploadAttestation);
export type CraftSkillUploadAttestation = z.infer<typeof CraftSkillUploadAttestationSchema>;

export const CraftSkillMediaTargetInfoSchema = z
  .object({
    skillType: MediaTypeSchema,
    originalFileName: z.string().min(1),
    ...craftSkillUploadAttestationShape,
  })
  .strict()
  .superRefine(refineCraftSkillUploadAttestation);

export const SquareStreetzTargetInfoSchema = z
  .object({
    mentions: SquareStreetzPostMentionsSchema,
  })
  .strict();

export const CommissionPostingTargetInfoSchema = z
  .object({
    title: textFieldSchema(COMMISSION_TITLE_INPUT),
    description: textFieldSchema(COMMISSION_DESCRIPTION_INPUT),
    requiredTradeProfessions: z
      .array(z.enum(TRADE_PROFESSION_VALUES))
      .max(TRADE_PROFESSION_OPTIONS.length),
    stakeSharesOffered: stakeSharesOfferedSchema,
    workProjectId: workProjectIdSchema,
  })
  .strict();

export const CommissionProposalTargetInfoSchema = z
  .object({
    commissionListingId: commissionListingIdSchema,
    replyText: textFieldSchema(COMMISSION_COVER_LETTER_INPUT),
  })
  .strict();

export const AuditionPromptTargetInfoSchema = z
  .object({
    auditionId: auditionIdSchema,
    type: z.literal('workAudition'),
    title: textFieldSchema(AUDITION_TITLE_INPUT),
    description: textFieldSchema(AUDITION_DESCRIPTION_INPUT),
    entriesCloseAt: AuditionDeadlineSchema,
    auditionCloseAt: AuditionDeadlineSchema,
    workProjectId: workProjectIdSchema,
    stakeSharesOffered: stakeSharesOfferedSchema.optional(),
    mode: AuditionModeSchema.optional(),
    expectedOptionCount: z
      .number()
      .int()
      .min(MIN_CURATED_AUDITION_OPTIONS)
      .max(MAX_CURATED_AUDITION_OPTIONS)
      .optional(),
  })
  .strict()
  .superRefine(refineAuditionDeadlineOrder);

export const SponsoredAuditionAmountUSDSchema = z
  .number()
  .positive()
  .finite()
  .max(MAX_SPONSORED_AUDITION_AMOUNT_USD);

const adminAuditionPromptFields = {
  auditionId: auditionIdSchema,
  title: textFieldSchema(AUDITION_TITLE_INPUT),
  description: textFieldSchema(AUDITION_DESCRIPTION_INPUT),
  entriesCloseAt: AuditionDeadlineSchema,
  auditionCloseAt: AuditionDeadlineSchema,
  mode: AuditionModeSchema.optional(),
  expectedOptionCount: z
    .number()
    .int()
    .min(MIN_CURATED_AUDITION_OPTIONS)
    .max(MAX_CURATED_AUDITION_OPTIONS)
    .optional(),
};

export const AdminAuditionPromptTargetInfoSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('platformAudition'), ...adminAuditionPromptFields }).strict(),
    z
      .object({
        type: z.literal('sponsoredAudition'),
        ...adminAuditionPromptFields,
        sponsoredAuditionAmountUSD: SponsoredAuditionAmountUSDSchema,
      })
      .strict(),
  ])
  .superRefine(refineAuditionDeadlineOrder);

export const AuditionEntryTargetInfoSchema = z
  .object({
    auditionId: auditionIdSchema,
  })
  .strict();

const HallLibraryCoverTargetInfoSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    itemType: z.enum(HALL_CONTENT_DETAIL_SURFACES),
    itemId: itemIdSchema,
  })
  .strict();

export const HallLibraryCoverSquareTargetInfoSchema = HallLibraryCoverTargetInfoSchema;
export const HallLibraryCoverPosterTargetInfoSchema = HallLibraryCoverTargetInfoSchema;
export const HallLibraryCoverCinematicTargetInfoSchema = HallLibraryCoverTargetInfoSchema;

export const RealmCoverTargetInfoSchema = z
  .object({
    workRealmId: workRealmIdSchema,
  })
  .strict();

export const ChapterPhotoTargetInfoSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    taleId: taleIdSchema,
    chapterId: chapterIdSchema,
  })
  .strict();

const TuneTrackMediaTargetInfoSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    tuneId: tuneIdSchema,
    trackId: trackIdSchema,
  })
  .strict();

export const TuneTrackPhotoTargetInfoSchema = TuneTrackMediaTargetInfoSchema;
export const TuneTrackAudioTargetInfoSchema = TuneTrackMediaTargetInfoSchema;

const TelevisionEpisodeMediaTargetInfoSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    televisionId: televisionIdSchema,
    episodeId: episodeIdSchema,
  })
  .strict();

export const TelevisionEpisodePhotoTargetInfoSchema = TelevisionEpisodeMediaTargetInfoSchema;
export const TelevisionEpisodeVideoTargetInfoSchema = TelevisionEpisodeMediaTargetInfoSchema;

export const ConversationFileTargetInfoSchema = ConversationFileRefSchema;

export const WorkAssetTargetInfoSchema = z
  .object({
    workProjectId: workProjectIdSchema,
    folderId: workFileFolderIdSchema,
  })
  .strict();

export const SystemContentTargetInfoSchema = z
  .object({
    slotId: SystemVideoSlotIdSchema,
  })
  .strict();

export type ProfilePictureTargetInfo = z.infer<typeof ProfilePictureTargetInfoSchema>;
export type CraftSkillMediaTargetInfo = z.infer<typeof CraftSkillMediaTargetInfoSchema>;
export type SquareStreetzTargetInfo = z.infer<typeof SquareStreetzTargetInfoSchema>;
export type CommissionPostingTargetInfo = z.infer<typeof CommissionPostingTargetInfoSchema>;
export type CommissionProposalTargetInfo = z.infer<typeof CommissionProposalTargetInfoSchema>;
export type AuditionPromptTargetInfo = z.infer<typeof AuditionPromptTargetInfoSchema>;
export type AdminAuditionPromptTargetInfo = z.infer<typeof AdminAuditionPromptTargetInfoSchema>;
export type AuditionEntryTargetInfo = z.infer<typeof AuditionEntryTargetInfoSchema>;
export type HallLibraryCoverSquareTargetInfo = z.infer<
  typeof HallLibraryCoverSquareTargetInfoSchema
>;
export type HallLibraryCoverPosterTargetInfo = z.infer<
  typeof HallLibraryCoverPosterTargetInfoSchema
>;
export type HallLibraryCoverCinematicTargetInfo = z.infer<
  typeof HallLibraryCoverCinematicTargetInfoSchema
>;
export type RealmCoverTargetInfo = z.infer<typeof RealmCoverTargetInfoSchema>;
export type ChapterPhotoTargetInfo = z.infer<typeof ChapterPhotoTargetInfoSchema>;
export type TuneTrackPhotoTargetInfo = z.infer<typeof TuneTrackPhotoTargetInfoSchema>;
export type TuneTrackAudioTargetInfo = z.infer<typeof TuneTrackAudioTargetInfoSchema>;
export type TelevisionEpisodePhotoTargetInfo = z.infer<
  typeof TelevisionEpisodePhotoTargetInfoSchema
>;
export type TelevisionEpisodeVideoTargetInfo = z.infer<
  typeof TelevisionEpisodeVideoTargetInfoSchema
>;
export type ConversationFileTargetInfo = z.infer<typeof ConversationFileTargetInfoSchema>;
export type WorkAssetTargetInfo = z.infer<typeof WorkAssetTargetInfoSchema>;
export type SystemContentTargetInfo = z.infer<typeof SystemContentTargetInfoSchema>;

export const NciiEvidenceTargetInfoSchema = z
  .object({
    requestReference: z.string().min(1),
  })
  .strict();
export type NciiEvidenceTargetInfo = z.infer<typeof NciiEvidenceTargetInfoSchema>;

export type TargetInfoFor<O extends FileOrigin> = O extends 'profile-picture'
  ? ProfilePictureTargetInfo
  : O extends 'craft-skill-media'
    ? CraftSkillMediaTargetInfo
    : O extends 'squareStreetz'
      ? SquareStreetzTargetInfo
      : O extends 'commission-posting'
        ? CommissionPostingTargetInfo
        : O extends 'commission-proposal'
          ? CommissionProposalTargetInfo
          : O extends 'audition-prompt'
            ? AuditionPromptTargetInfo
            : O extends 'admin-audition-prompt'
              ? AdminAuditionPromptTargetInfo
              : O extends 'audition-entry'
                ? AuditionEntryTargetInfo
                : O extends 'hallLibrary-cover-square'
                  ? HallLibraryCoverSquareTargetInfo
                  : O extends 'hallLibrary-cover-poster'
                    ? HallLibraryCoverPosterTargetInfo
                    : O extends 'hallLibrary-cover-cinematic'
                      ? HallLibraryCoverCinematicTargetInfo
                      : O extends 'realm-cover'
                        ? RealmCoverTargetInfo
                        : O extends 'chapter-photo'
                          ? ChapterPhotoTargetInfo
                          : O extends 'tune-track-photo'
                            ? TuneTrackPhotoTargetInfo
                            : O extends 'tune-track-audio'
                              ? TuneTrackAudioTargetInfo
                              : O extends 'television-episode-photo'
                                ? TelevisionEpisodePhotoTargetInfo
                                : O extends 'television-episode-video'
                                  ? TelevisionEpisodeVideoTargetInfo
                                  : O extends 'conversation-file'
                                    ? ConversationFileTargetInfo
                                    : O extends 'work-asset'
                                      ? WorkAssetTargetInfo
                                      : O extends 'system-content'
                                        ? SystemContentTargetInfo
                                        : O extends 'ncii-evidence'
                                          ? NciiEvidenceTargetInfo
                                          : never;

function assertNever(x: never): never {
  throw new Error(`Unexpected fileOrigin: ${String(x)}`);
}

export function parseTargetInfo<O extends FileOrigin>(
  fileOrigin: O,
  raw: unknown,
): TargetInfoFor<O> {
  switch (fileOrigin) {
    case 'profile-picture':
      return ProfilePictureTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'craft-skill-media':
      return CraftSkillMediaTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'squareStreetz':
      return SquareStreetzTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'commission-posting':
      return CommissionPostingTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'commission-proposal':
      return CommissionProposalTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'audition-prompt':
      return AuditionPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'admin-audition-prompt':
      return AdminAuditionPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'audition-entry':
      return AuditionEntryTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-square':
      return HallLibraryCoverSquareTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-poster':
      return HallLibraryCoverPosterTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-cinematic':
      return HallLibraryCoverCinematicTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'realm-cover':
      return RealmCoverTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'chapter-photo':
      return ChapterPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'tune-track-photo':
      return TuneTrackPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'tune-track-audio':
      return TuneTrackAudioTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'television-episode-photo':
      return TelevisionEpisodePhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'television-episode-video':
      return TelevisionEpisodeVideoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'conversation-file':
      return ConversationFileTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'work-asset':
      return WorkAssetTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'system-content':
      return SystemContentTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'ncii-evidence':
      return NciiEvidenceTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    default:
      return assertNever(fileOrigin);
  }
}
