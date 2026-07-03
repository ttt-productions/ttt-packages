import { z } from "zod";
import type { FileOrigin } from "./file-origin.js";
import { MentionSchema, rejectDuplicateMentionPlaceholders } from "./atoms.js";
import { TRADE_PROFESSION_OPTIONS } from "../constants/options.js";
import {
  MAX_MENTIONS,
  MAX_POST_LENGTH,
  MAX_COMMISSION_TITLE_LENGTH,
  MAX_COMMISSION_DESCRIPTION_LENGTH,
  MAX_AUDITION_TITLE_LENGTH,
  MAX_AUDITION_DESCRIPTION_LENGTH,
  MAX_WORK_PROJECT_STAKE_SHARES,
  MAX_SPONSORED_AUDITION_AMOUNT_USD,
  MAX_CHAT_REPLY_PREVIEW_LENGTH,
} from "../constants/business.js";

const TRADE_PROFESSION_VALUES = [...TRADE_PROFESSION_OPTIONS] as [string, ...string[]];

export const ProfilePictureTargetInfoSchema = z.object({}).strict();

export const CraftSkillMediaTargetInfoSchema = z
  .object({
    craftSkillId: z.string().min(1),
    skillType: z.enum(['image', 'video', 'audio', 'other']),
    originalFileName: z.string().min(1),
  })
  .strict();

// squareStreetz: mentions array of structured Mention objects. Capped at
// MAX_MENTIONS with unique placeholders (duplicate placeholders collide at render
// time — both tokens resolve to the later entity).
export const SquareStreetzTargetInfoSchema = z
  .object({
    mentions: z
      .array(MentionSchema)
      .max(MAX_MENTIONS)
      .superRefine(rejectDuplicateMentionPlaceholders),
  })
  .strict();

// Per-origin text (caption) rule for the squareStreetz media-upload path. The caption
// travels as StartUploadRequest.textContent (top-level, generic + optional) — not inside
// targetInfo — so `startUpload` validates it with THIS schema when
// fileOrigin === 'squareStreetz', mirroring the text-post callable's
// CreateSquareStreetzTextPostInputSchema.textContent (min 1, max MAX_POST_LENGTH). This
// closes the media-path gap where a caption was accepted unbounded / empty.
export const SquareStreetzCaptionSchema = z.string().min(1).max(MAX_POST_LENGTH);

// commission-posting: full commission creation payload.
export const CommissionPostingTargetInfoSchema = z
  .object({
    commissionListingId: z.string().min(1),
    title: z.string().min(1).max(MAX_COMMISSION_TITLE_LENGTH),
    description: z.string().max(MAX_COMMISSION_DESCRIPTION_LENGTH),
    requiredTradeProfessions: z.array(z.enum(TRADE_PROFESSION_VALUES)).max(TRADE_PROFESSION_OPTIONS.length),
    // min(1): the create core rejects 0 shares (invalid-argument) at PUBLISH — after
    // upload/transcode/moderation — so fail fast at the trust boundary instead of burning
    // the activation-job retry budget on a deterministic dead-letter.
    stakeSharesOffered: z.number().int().min(1).max(MAX_WORK_PROJECT_STAKE_SHARES),
    workProjectId: z.string().min(1),
  })
  .strict();

export const CommissionProposalTargetInfoSchema = z
  .object({
    commissionListingId: z.string().min(1),
    replyText: z.string().max(MAX_COMMISSION_DESCRIPTION_LENGTH),
  })
  .strict();

// audition-prompt: workProject-owned audition creation payload (workAudition only).
export const AuditionPromptTargetInfoSchema = z
  .object({
    auditionId: z.string().min(1),
    type: z.literal('workAudition'),
    title: z.string().min(1).max(MAX_AUDITION_TITLE_LENGTH),
    description: z.string().max(MAX_AUDITION_DESCRIPTION_LENGTH),
    openTill: z.number().int().positive(),
    workProjectId: z.string().min(1),
    // min(1): the create core rejects <1 shares at PUBLISH (see CommissionPosting above).
    // Optional — defaults to a floor of 1 at invite time when absent.
    stakeSharesOffered: z.number().int().min(1).max(MAX_WORK_PROJECT_STAKE_SHARES).optional(),
    // Curated vs open audition. Absent ⇒ 'open' (community replies + votes). 'curated' ⇒ the
    // creating work posts the option entries itself and users may ONLY vote (the create/reply
    // callable derives each option entry's isCreatorOption server-side and rejects community replies).
    mode: z.enum(['open', 'curated']).optional(),
    // Curated ONLY: the fixed number of creator option videos (2..8) in the atomic batch, carried from
    // the Create click through targetInfo so the create core sets it on the Audition doc and the reveal
    // coordinator knows when ALL options have landed. Required by the create core when mode==='curated'.
    expectedOptionCount: z.number().int().min(2).max(8).optional(),
  })
  .strict();

// admin-audition-prompt: admin-operated featured/sponsored audition creation payload.
export const AdminAuditionPromptTargetInfoSchema = z
  .object({
    auditionId: z.string().min(1),
    type: z.enum(['platformAudition', 'sponsoredAudition']),
    title: z.string().min(1).max(MAX_AUDITION_TITLE_LENGTH),
    description: z.string().max(MAX_AUDITION_DESCRIPTION_LENGTH),
    openTill: z.number().int().positive(),
    sponsoredAuditionAmountUSD: z.number().nonnegative().finite().max(MAX_SPONSORED_AUDITION_AMOUNT_USD).optional(),
    // Curated vs open (see AuditionPromptTargetInfoSchema.mode). Absent ⇒ 'open'.
    mode: z.enum(['open', 'curated']).optional(),
    // Curated ONLY: fixed number of option videos (2..8) in the atomic batch (see
    // AuditionPromptTargetInfoSchema.expectedOptionCount). Required by the create core when curated.
    expectedOptionCount: z.number().int().min(2).max(8).optional(),
  })
  .strict();

export const AuditionEntryTargetInfoSchema = z
  .object({
    auditionId: z.string().min(1),
  })
  .strict();

// ───────────────────────────────────────────────────────────────────
// HALL LIBRARY COVER target info (square / poster / cinematic).
// All three origins share one shape. The processor uses fileOrigin to
// pick which field on the target doc gets written (see
// HALL_LIBRARY_TARGET_FIELDS in `hall-library-target-fields.ts`).
//
// itemType discriminates which parent collection — `workProjectTales` vs
// `workProjectTunes` vs `workProjectTelevision`. fileOrigin alone does NOT
// disambiguate this because all three cover origins target whichever
// hallLibrary item the user is editing.
// ───────────────────────────────────────────────────────────────────
const HallLibraryCoverTargetInfoSchema = z
  .object({
    workProjectId: z.string().min(1),
    itemType: z.enum(['tale', 'tune', 'television']),
    itemId: z.string().min(1),
  })
  .strict();

export const HallLibraryCoverSquareTargetInfoSchema = HallLibraryCoverTargetInfoSchema;
export const HallLibraryCoverPosterTargetInfoSchema = HallLibraryCoverTargetInfoSchema;
export const HallLibraryCoverCinematicTargetInfoSchema = HallLibraryCoverTargetInfoSchema;

// ───────────────────────────────────────────────────────────────────
// SUB-ITEM target info — one shape per item type, NOT per media kind.
// chapter-photo uses ChapterPhotoTargetInfoSchema.
// tune-track-photo + tune-track-audio share TuneTrackMediaTargetInfoSchema.
// television-episode-photo + television-episode-video share TelevisionEpisodeMediaTargetInfoSchema.
// The processor derives the doc path from these IDs via
// PATH_BUILDERS.taleChapter / .tuneTrack / .televisionEpisode, and derives the
// field name from fileOrigin via HALL_LIBRARY_TARGET_FIELDS.
// ───────────────────────────────────────────────────────────────────
export const ChapterPhotoTargetInfoSchema = z
  .object({
    workProjectId: z.string().min(1),
    taleId: z.string().min(1),
    chapterId: z.string().min(1),
  })
  .strict();

const TuneTrackMediaTargetInfoSchema = z
  .object({
    workProjectId: z.string().min(1),
    tuneId: z.string().min(1),
    trackId: z.string().min(1),
  })
  .strict();

export const TuneTrackPhotoTargetInfoSchema = TuneTrackMediaTargetInfoSchema;
export const TuneTrackAudioTargetInfoSchema = TuneTrackMediaTargetInfoSchema;

const TelevisionEpisodeMediaTargetInfoSchema = z
  .object({
    workProjectId: z.string().min(1),
    televisionId: z.string().min(1),
    episodeId: z.string().min(1),
  })
  .strict();

export const TelevisionEpisodePhotoTargetInfoSchema = TelevisionEpisodeMediaTargetInfoSchema;
export const TelevisionEpisodeVideoTargetInfoSchema = TelevisionEpisodeMediaTargetInfoSchema;

// guild-chat-message-attachment: discriminated by threadKind.
const ChatReplyToSchema = z
  .object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    messagePreview: z.string().max(MAX_CHAT_REPLY_PREVIEW_LENGTH),
  })
  .strict();

export const ChatAttachmentTargetInfoSchema = z.discriminatedUnion('threadKind', [
  z
    .object({
      threadKind: z.literal('guildChatChannel'),
      workProjectId: z.string().min(1),
      guildChatChannelId: z.string().min(1),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
  z
    .object({
      threadKind: z.literal('guildInvite'),
      guildInviteId: z.string().min(1),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
  z
    .object({
      threadKind: z.literal('adminSupport'),
      adminDispatchId: z.string().min(1),
      isUserReply: z.boolean(),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
]);

export const WorkAssetTargetInfoSchema = z
  .object({
    workProjectId: z.string().min(1),
    // The folder the file is uploaded INTO (S7 folder system). Custom folders gate
    // upload by trade profession; the default folder accepts any active guildmate.
    folderId: z.string().min(1),
  })
  .strict();

// ---- type aliases ----

export type ProfilePictureTargetInfo = z.infer<typeof ProfilePictureTargetInfoSchema>;
export type CraftSkillMediaTargetInfo = z.infer<typeof CraftSkillMediaTargetInfoSchema>;
export type SquareStreetzTargetInfo = z.infer<typeof SquareStreetzTargetInfoSchema>;
export type CommissionPostingTargetInfo = z.infer<typeof CommissionPostingTargetInfoSchema>;
export type CommissionProposalTargetInfo = z.infer<typeof CommissionProposalTargetInfoSchema>;
export type AuditionPromptTargetInfo = z.infer<typeof AuditionPromptTargetInfoSchema>;
export type AdminAuditionPromptTargetInfo = z.infer<typeof AdminAuditionPromptTargetInfoSchema>;
export type AuditionEntryTargetInfo = z.infer<typeof AuditionEntryTargetInfoSchema>;
export type HallLibraryCoverSquareTargetInfo = z.infer<typeof HallLibraryCoverSquareTargetInfoSchema>;
export type HallLibraryCoverPosterTargetInfo = z.infer<typeof HallLibraryCoverPosterTargetInfoSchema>;
export type HallLibraryCoverCinematicTargetInfo = z.infer<typeof HallLibraryCoverCinematicTargetInfoSchema>;
export type ChapterPhotoTargetInfo = z.infer<typeof ChapterPhotoTargetInfoSchema>;
export type TuneTrackPhotoTargetInfo = z.infer<typeof TuneTrackPhotoTargetInfoSchema>;
export type TuneTrackAudioTargetInfo = z.infer<typeof TuneTrackAudioTargetInfoSchema>;
export type TelevisionEpisodePhotoTargetInfo = z.infer<typeof TelevisionEpisodePhotoTargetInfoSchema>;
export type TelevisionEpisodeVideoTargetInfo = z.infer<typeof TelevisionEpisodeVideoTargetInfoSchema>;
export type ChatAttachmentTargetInfo = z.infer<typeof ChatAttachmentTargetInfoSchema>;
export type WorkAssetTargetInfo = z.infer<typeof WorkAssetTargetInfoSchema>;

// ncii-evidence: ties the uploaded evidence to a take-it-down request by its
// public reference. The processor attaches the evidence record to that request.
export const NciiEvidenceTargetInfoSchema = z
  .object({
    requestReference: z.string().min(1),
  })
  .strict();
export type NciiEvidenceTargetInfo = z.infer<typeof NciiEvidenceTargetInfoSchema>;

// Mapped type: given a FileOrigin literal, returns its targetInfo shape.
export type TargetInfoFor<O extends FileOrigin> =
  O extends 'profile-picture' ? ProfilePictureTargetInfo
  : O extends 'craft-skill-media' ? CraftSkillMediaTargetInfo
  : O extends 'squareStreetz' ? SquareStreetzTargetInfo
  : O extends 'commission-posting' ? CommissionPostingTargetInfo
  : O extends 'commission-proposal' ? CommissionProposalTargetInfo
  : O extends 'audition-prompt' ? AuditionPromptTargetInfo
  : O extends 'admin-audition-prompt' ? AdminAuditionPromptTargetInfo
  : O extends 'audition-entry' ? AuditionEntryTargetInfo
  : O extends 'hallLibrary-cover-square' ? HallLibraryCoverSquareTargetInfo
  : O extends 'hallLibrary-cover-poster' ? HallLibraryCoverPosterTargetInfo
  : O extends 'hallLibrary-cover-cinematic' ? HallLibraryCoverCinematicTargetInfo
  : O extends 'chapter-photo' ? ChapterPhotoTargetInfo
  : O extends 'tune-track-photo' ? TuneTrackPhotoTargetInfo
  : O extends 'tune-track-audio' ? TuneTrackAudioTargetInfo
  : O extends 'television-episode-photo' ? TelevisionEpisodePhotoTargetInfo
  : O extends 'television-episode-video' ? TelevisionEpisodeVideoTargetInfo
  : O extends 'guild-chat-message-attachment' ? ChatAttachmentTargetInfo
  : O extends 'work-asset' ? WorkAssetTargetInfo
  : O extends 'ncii-evidence' ? NciiEvidenceTargetInfo
  : never;

function assertNever(x: never): never {
  throw new Error(`Unexpected fileOrigin: ${String(x)}`);
}

export function parseTargetInfo<O extends FileOrigin>(
  fileOrigin: O,
  raw: unknown
): TargetInfoFor<O> {
  switch (fileOrigin) {
    case 'profile-picture': return ProfilePictureTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'craft-skill-media': return CraftSkillMediaTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'squareStreetz': return SquareStreetzTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'commission-posting': return CommissionPostingTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'commission-proposal': return CommissionProposalTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'audition-prompt': return AuditionPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'admin-audition-prompt': return AdminAuditionPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'audition-entry': return AuditionEntryTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-square': return HallLibraryCoverSquareTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-poster': return HallLibraryCoverPosterTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-cinematic': return HallLibraryCoverCinematicTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'chapter-photo': return ChapterPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'tune-track-photo': return TuneTrackPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'tune-track-audio': return TuneTrackAudioTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'television-episode-photo': return TelevisionEpisodePhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'television-episode-video': return TelevisionEpisodeVideoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'guild-chat-message-attachment': return ChatAttachmentTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'work-asset': return WorkAssetTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'ncii-evidence': return NciiEvidenceTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    default: return assertNever(fileOrigin);
  }
}




