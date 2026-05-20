import { z } from "zod";
import type { FileOrigin } from "./file-origin.js";
import { MentionSchema } from "./atoms.js";

// profile-picture: no origin-specific fields.
export const ProfilePictureTargetInfoSchema = z.object({}).strict();

// skill-media: skillId + skillType + originalFileName
export const SkillMediaTargetInfoSchema = z
  .object({
    skillId: z.string().min(1),
    skillType: z.enum(['image', 'video', 'audio', 'other']),
    originalFileName: z.string().min(1),
  })
  .strict();

// streetz: mentions array of structured Mention objects.
export const StreetzTargetInfoSchema = z
  .object({
    mentions: z.array(MentionSchema),
  })
  .strict();

// job-posting: full job creation payload.
export const JobPostingTargetInfoSchema = z
  .object({
    jobId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    requiredProfessions: z.array(z.string()),
    sharesOffered: z.number(),
    projectId: z.string().min(1),
    createdBy: z.object({ uid: z.string().min(1) }).strict(),
  })
  .strict();

// job-reply: jobId + replyText.
export const JobReplyTargetInfoSchema = z
  .object({
    jobId: z.string().min(1),
    replyText: z.string(),
  })
  .strict();

// opportunity-prompt: project-owned opportunity creation payload (ProjectInput only).
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

// admin-opportunity-prompt: admin-operated featured/sponsored opportunity creation payload.
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

// opportunity-reply: opportunityId only.
export const OpportunityReplyTargetInfoSchema = z
  .object({
    opportunityId: z.string().min(1),
  })
  .strict();

// library-cover-* (square / poster / cinematic): same shape for all three.
const LibraryCoverTargetInfoShape = z
  .object({
    docPath: z.string().min(1),
    fields: z.record(z.string()),
  })
  .strict();

export const LibraryCoverSquareTargetInfoSchema = LibraryCoverTargetInfoShape;
export const LibraryCoverPosterTargetInfoSchema = LibraryCoverTargetInfoShape;
export const LibraryCoverCinematicTargetInfoSchema = LibraryCoverTargetInfoShape;

// chapter-photo, song-photo, song-audio, show-photo, show-video:
// same shape — docPath + fields with a single `full` key.
const SubItemTargetInfoShape = z
  .object({
    docPath: z.string().min(1),
    fields: z.object({ full: z.string().min(1) }).strict(),
  })
  .strict();

export const ChapterPhotoTargetInfoSchema = SubItemTargetInfoShape;
export const SongPhotoTargetInfoSchema = SubItemTargetInfoShape;
export const SongAudioTargetInfoSchema = SubItemTargetInfoShape;
export const ShowPhotoTargetInfoSchema = SubItemTargetInfoShape;
export const ShowVideoTargetInfoSchema = SubItemTargetInfoShape;

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
      threadKind: z.literal('projectInvite'),
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

// project-file: projectId only.
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
  : O extends 'skill-media' ? SkillMediaTargetInfo
  : O extends 'streetz' ? StreetzTargetInfo
  : O extends 'job-posting' ? JobPostingTargetInfo
  : O extends 'job-reply' ? JobReplyTargetInfo
  : O extends 'opportunity-prompt' ? OpportunityPromptTargetInfo
  : O extends 'admin-opportunity-prompt' ? AdminOpportunityPromptTargetInfo
  : O extends 'opportunity-reply' ? OpportunityReplyTargetInfo
  : O extends 'library-cover-square' ? LibraryCoverSquareTargetInfo
  : O extends 'library-cover-poster' ? LibraryCoverPosterTargetInfo
  : O extends 'library-cover-cinematic' ? LibraryCoverCinematicTargetInfo
  : O extends 'chapter-photo' ? ChapterPhotoTargetInfo
  : O extends 'song-photo' ? SongPhotoTargetInfo
  : O extends 'song-audio' ? SongAudioTargetInfo
  : O extends 'show-photo' ? ShowPhotoTargetInfo
  : O extends 'show-video' ? ShowVideoTargetInfo
  : O extends 'chat-attachment' ? ChatAttachmentTargetInfo
  : O extends 'project-file' ? ProjectFileTargetInfo
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
    case 'skill-media': return SkillMediaTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'streetz': return StreetzTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'job-posting': return JobPostingTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'job-reply': return JobReplyTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'opportunity-prompt': return OpportunityPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'admin-opportunity-prompt': return AdminOpportunityPromptTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'opportunity-reply': return OpportunityReplyTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'library-cover-square': return LibraryCoverSquareTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'library-cover-poster': return LibraryCoverPosterTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'library-cover-cinematic': return LibraryCoverCinematicTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'chapter-photo': return ChapterPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'song-photo': return SongPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'song-audio': return SongAudioTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'show-photo': return ShowPhotoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'show-video': return ShowVideoTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'chat-attachment': return ChatAttachmentTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    case 'project-file': return ProjectFileTargetInfoSchema.parse(raw) as TargetInfoFor<O>;
    default: return assertNever(fileOrigin);
  }
}

