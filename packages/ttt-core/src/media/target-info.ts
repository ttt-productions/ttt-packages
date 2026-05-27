import { z } from "zod";
import type { FileOrigin } from "./file-origin.js";
import { MentionSchema } from "./atoms.js";

// profile-picture: no origin-specific fields.
export const ProfilePictureTargetInfoSchema = z.object({}).strict();

// craftSkill-media: skillId + skillType + originalFileName
export const SkillMediaTargetInfoSchema = z
  .object({
    skillId: z.string().min(1),
    skillType: z.enum(['image', 'video', 'audio', 'other']),
    originalFileName: z.string().min(1),
  })
  .strict();

// squareStreetz: mentions array of structured Mention objects.
export const StreetzTargetInfoSchema = z
  .object({
    mentions: z.array(MentionSchema),
  })
  .strict();

// commission-posting: full commission creation payload.
export const JobPostingTargetInfoSchema = z
  .object({
    jobId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    requiredTradeProfessions: z.array(z.string()),
    sharesOffered: z.number(),
    projectId: z.string().min(1),
    createdBy: z.object({ uid: z.string().min(1) }).strict(),
  })
  .strict();

// commission-reply: jobId + replyText.
export const JobReplyTargetInfoSchema = z
  .object({
    jobId: z.string().min(1),
    replyText: z.string(),
  })
  .strict();

// audition-prompt: workProject-owned audition creation payload (ProjectInput only).
export const OpportunityPromptTargetInfoSchema = z
  .object({
    opportunityId: z.string().min(1),
    type: z.literal('ProjectInput'),
    title: z.string().min(1),
    description: z.string(),
    openTill: z.number(),
    createdBy: z.object({ uid: z.string().min(1) }).strict(),
    projectId: z.string().min(1),
    sharesOffered: z.number().optional(),
  })
  .strict();

// admin-audition-prompt: admin-operated featured/sponsored audition creation payload.
export const AdminOpportunityPromptTargetInfoSchema = z
  .object({
    opportunityId: z.string().min(1),
    type: z.enum(['SystemInput', 'SponsoredProjects']),
    title: z.string().min(1),
    description: z.string(),
    openTill: z.number(),
    createdBy: z.object({ uid: z.string().min(1) }).strict(),
    projectAmountUSD: z.number().optional(),
  })
  .strict();

// audition-reply: opportunityId only.
export const OpportunityReplyTargetInfoSchema = z
  .object({
    opportunityId: z.string().min(1),
  })
  .strict();

// ───────────────────────────────────────────────────────────────────
// LIBRARY-COVER target info (square / poster / cinematic).
// All three origins share one shape. The processor uses fileOrigin to
// pick which field on the target doc gets written (see
// LIBRARY_TARGET_FIELDS in `hall-library-target-fields.ts`).
//
// itemType discriminates which parent collection — `workProjectTales` vs
// `workProjectTunes` vs `workProjectTelevision`. fileOrigin alone does NOT
// disambiguate this because all three cover origins target whichever
// hallLibrary item the user is editing.
// ───────────────────────────────────────────────────────────────────
const LibraryCoverTargetInfoSchema = z
  .object({
    projectId: z.string().min(1),
    itemType: z.enum(['tale', 'tune', 'television']),
    itemId: z.string().min(1),
  })
  .strict();

export const LibraryCoverSquareTargetInfoSchema = LibraryCoverTargetInfoSchema;
export const LibraryCoverPosterTargetInfoSchema = LibraryCoverTargetInfoSchema;
export const LibraryCoverCinematicTargetInfoSchema = LibraryCoverTargetInfoSchema;

// ───────────────────────────────────────────────────────────────────
// SUB-ITEM target info — one shape per item type, NOT per media kind.
// chapter-photo uses ChapterPhotoTargetInfoSchema.
// song-photo + song-audio share SongMediaTargetInfoSchema.
// show-photo + show-video share ShowMediaTargetInfoSchema.
// The processor derives the doc path from these IDs via
// PATH_BUILDERS.taleChapter / .tuneTrack / .televisionEpisode, and derives the
// field name from fileOrigin via LIBRARY_TARGET_FIELDS.
// ───────────────────────────────────────────────────────────────────
export const ChapterPhotoTargetInfoSchema = z
  .object({
    projectId: z.string().min(1),
    taleId: z.string().min(1),
    chapterId: z.string().min(1),
  })
  .strict();

const SongMediaTargetInfoSchema = z
  .object({
    projectId: z.string().min(1),
    tuneId: z.string().min(1),
    trackId: z.string().min(1),
  })
  .strict();

export const SongPhotoTargetInfoSchema = SongMediaTargetInfoSchema;
export const SongAudioTargetInfoSchema = SongMediaTargetInfoSchema;

const ShowMediaTargetInfoSchema = z
  .object({
    projectId: z.string().min(1),
    televisionId: z.string().min(1),
    episodeId: z.string().min(1),
  })
  .strict();

export const ShowPhotoTargetInfoSchema = ShowMediaTargetInfoSchema;
export const ShowVideoTargetInfoSchema = ShowMediaTargetInfoSchema;

// chat-attachment: discriminated by threadKind.
const ChatReplyToSchema = z
  .object({
    messageId: z.string().min(1),
    senderId: z.string().min(1),
    messagePreview: z.string(),
  })
  .strict();

export const ChatAttachmentTargetInfoSchema = z.discriminatedUnion('threadKind', [
  z
    .object({
      threadKind: z.literal('projectChannel'),
      projectId: z.string().min(1),
      channelId: z.string().min(1),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
  z
    .object({
      threadKind: z.literal('guildInvite'),
      inviteId: z.string().min(1),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
  z
    .object({
      threadKind: z.literal('adminSupport'),
      adminMessageId: z.string().min(1),
      isUserReply: z.boolean(),
      replyTo: ChatReplyToSchema.optional(),
    })
    .strict(),
]);

// workProject-file: projectId only.
export const ProjectFileTargetInfoSchema = z
  .object({
    projectId: z.string().min(1),
  })
  .strict();

// ---- type aliases ----

export type ProfilePictureTargetInfo = z.infer<typeof ProfilePictureTargetInfoSchema>;
export type SkillMediaTargetInfo = z.infer<typeof SkillMediaTargetInfoSchema>;
export type StreetzTargetInfo = z.infer<typeof StreetzTargetInfoSchema>;
export type JobPostingTargetInfo = z.infer<typeof JobPostingTargetInfoSchema>;
export type JobReplyTargetInfo = z.infer<typeof JobReplyTargetInfoSchema>;
export type OpportunityPromptTargetInfo = z.infer<typeof OpportunityPromptTargetInfoSchema>;
export type AdminOpportunityPromptTargetInfo = z.infer<typeof AdminOpportunityPromptTargetInfoSchema>;
export type OpportunityReplyTargetInfo = z.infer<typeof OpportunityReplyTargetInfoSchema>;
export type LibraryCoverSquareTargetInfo = z.infer<typeof LibraryCoverSquareTargetInfoSchema>;
export type LibraryCoverPosterTargetInfo = z.infer<typeof LibraryCoverPosterTargetInfoSchema>;
export type LibraryCoverCinematicTargetInfo = z.infer<typeof LibraryCoverCinematicTargetInfoSchema>;
export type ChapterPhotoTargetInfo = z.infer<typeof ChapterPhotoTargetInfoSchema>;
export type SongPhotoTargetInfo = z.infer<typeof SongPhotoTargetInfoSchema>;
export type SongAudioTargetInfo = z.infer<typeof SongAudioTargetInfoSchema>;
export type ShowPhotoTargetInfo = z.infer<typeof ShowPhotoTargetInfoSchema>;
export type ShowVideoTargetInfo = z.infer<typeof ShowVideoTargetInfoSchema>;
export type ChatAttachmentTargetInfo = z.infer<typeof ChatAttachmentTargetInfoSchema>;
export type ProjectFileTargetInfo = z.infer<typeof ProjectFileTargetInfoSchema>;

// Mapped type: given a FileOrigin literal, returns its targetInfo shape.
export type TargetInfoFor<O extends FileOrigin> =
  O extends 'profile-picture' ? ProfilePictureTargetInfo
  : O extends 'craftSkill-media' ? SkillMediaTargetInfo
  : O extends 'squareStreetz' ? StreetzTargetInfo
  : O extends 'commission-posting' ? JobPostingTargetInfo
  : O extends 'commission-reply' ? JobReplyTargetInfo
  : O extends 'audition-prompt' ? OpportunityPromptTargetInfo
  : O extends 'admin-audition-prompt' ? AdminOpportunityPromptTargetInfo
  : O extends 'audition-reply' ? OpportunityReplyTargetInfo
  : O extends 'hallLibrary-cover-square' ? LibraryCoverSquareTargetInfo
  : O extends 'hallLibrary-cover-poster' ? LibraryCoverPosterTargetInfo
  : O extends 'hallLibrary-cover-cinematic' ? LibraryCoverCinematicTargetInfo
  : O extends 'chapter-photo' ? ChapterPhotoTargetInfo
  : O extends 'song-photo' ? SongPhotoTargetInfo
  : O extends 'song-audio' ? SongAudioTargetInfo
  : O extends 'show-photo' ? ShowPhotoTargetInfo
  : O extends 'show-video' ? ShowVideoTargetInfo
  : O extends 'chat-attachment' ? ChatAttachmentTargetInfo
  : O extends 'workProject-file' ? ProjectFileTargetInfo
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
    case 'craftSkill-media': return SkillMediaTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'squareStreetz': return StreetzTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'commission-posting': return JobPostingTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'commission-reply': return JobReplyTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'audition-prompt': return OpportunityPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'admin-audition-prompt': return AdminOpportunityPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'audition-reply': return OpportunityReplyTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-square': return LibraryCoverSquareTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-poster': return LibraryCoverPosterTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'hallLibrary-cover-cinematic': return LibraryCoverCinematicTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'chapter-photo': return ChapterPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'song-photo': return SongPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'song-audio': return SongAudioTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'show-photo': return ShowPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'show-video': return ShowVideoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'chat-attachment': return ChatAttachmentTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'workProject-file': return ProjectFileTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    default: return assertNever(fileOrigin);
  }
}

