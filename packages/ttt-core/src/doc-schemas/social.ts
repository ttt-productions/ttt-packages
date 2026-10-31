import { z } from 'zod';
import {
  MentionSchema,
  SquareStreetzPostMentionsSchema,
  refineMentionCorrespondence,
} from '../media/atoms.js';
import { FollowableTargetTypeSchema } from '../schemas/social.js';
import { ContentMediaKindSchema } from './media-assets.js';
import { ModerationHiddenBySchema } from './moderation.js';
import { CraftSkillKindSchema, CraftSkillSourceReferenceSchema } from './user.js';
import { HallSubItemTypeSchema } from './content.js';
import { CRAFT_SKILL_TAG_OPTIONS } from '../constants/options.js';
import { WORK_PROJECT_TYPE_KEYS } from '../types/content.js';

export const MediaTypeSchema = z.enum(['image', 'video', 'audio', 'other']);
export type MediaType = z.infer<typeof MediaTypeSchema>;
const mediaTypeSchema = MediaTypeSchema;

export const AuditionAnnounceKindSchema = z.enum(['work', 'platform', 'sponsored']);
export type AuditionAnnounceKind = z.infer<typeof AuditionAnnounceKindSchema>;

export const SquareStreetzPostTypeSchema = z.enum([
  'PROFILE_PICTURE_UPDATE',
  'NEW_CRAFT_SKILL',
  'NEW_ARTISAN_CREATOR',
  'COMMISSION_ACCEPTED',
  'DELETE_CRAFT_SKILL',
  'USER_POST',
  'NEW_WORK_PROJECT',
  'LIBRARY_PUBLISHED',
  'NEW_AUDITION',
  'NEW_COMMISSION',
]);
export type SquareStreetzPostType = z.infer<typeof SquareStreetzPostTypeSchema>;

export function isTownCrierPostType(postType: SquareStreetzPostType): boolean {
  return postType !== 'USER_POST';
}

export const SquareStreetzPostSchema = z
  .object({
    postId: z.string(),
    createdBy: z.object({ uid: z.string() }).optional(),
    authorId: z.string().optional(),
    content: z.string(),
    mentions: SquareStreetzPostMentionsSchema.optional(),
    relatedIds: z.array(z.string()),
    mediaAssetId: z.string().optional(),
    mediaType: mediaTypeSchema.optional(),
    createdAt: z.number(),
    likes: z.number(),
    postType: SquareStreetzPostTypeSchema,
    relatedAssetId: z.string().optional(),
    hidden: z.boolean(),
    hiddenBy: ModerationHiddenBySchema.optional(),
  })
  .superRefine((val, ctx) => {
    refineMentionCorrespondence(val.content, val.mentions, ctx);
    const townCrier = isTownCrierPostType(val.postType);
    for (const field of ['createdBy', 'authorId'] as const) {
      if (townCrier && val[field] !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `A Town Crier post is a system post with no author, so it carries no ${field}`,
        });
      }
      if (!townCrier && val[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `A member's own post names its author in ${field}`,
        });
      }
    }
    if (val.mediaAssetId !== undefined && val.mediaType === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['mediaType'],
        message:
          'mediaType is required whenever a post carries mediaAssetId (RULE-STD-MEDIA-101: an extensionless gateway URL with no kind renders a Download link instead of the media)',
      });
    }
    if (val.mediaType !== undefined && val.mediaAssetId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['mediaAssetId'],
        message:
          'mediaType is only allowed on a post that carries mediaAssetId — an orphan kind describes media the post does not have',
      });
    }
  });
export type SquareStreetzPost = z.infer<typeof SquareStreetzPostSchema>;

export const CreateSquareStreetzTextPostResultSchema = z.object({
  post: SquareStreetzPostSchema,
});
export type CreateSquareStreetzTextPostResult = z.infer<
  typeof CreateSquareStreetzTextPostResultSchema
>;

// Non-strict, with no pairing refinement: it is parsed inside the announcing transaction, where a
// throw would fail the primary action (RULE-STD-ENG-009).
export const SquareStreetzPostPayloadSchema = z.object({
  userId: z.string(),
  mentions: SquareStreetzPostMentionsSchema.optional(),
  newMediaAssetId: z.string().optional(),
  craftSkill: z
    .object({
      id: z.string(),
      mediaAssetId: z.string(),
      type: ContentMediaKindSchema,
      tags: z.array(z.enum(CRAFT_SKILL_TAG_OPTIONS)).optional(),
      kind: CraftSkillKindSchema.optional(),
      source: CraftSkillSourceReferenceSchema.optional(),
    })
    .optional(),
  craftSkillId: z.string().optional(),
  workProjectId: z.string().optional(),
  workProjectType: z.enum(WORK_PROJECT_TYPE_KEYS).optional(),
  workRealmId: z.string().optional(),
  workRealmIsPublic: z.boolean().optional(),
  hallItemId: z.string().optional(),
  hallSubItemType: HallSubItemTypeSchema.optional(),
  content: z.string().optional(),
  mediaAssetId: z.string().optional(),
  mediaType: mediaTypeSchema.optional(),
  createdAt: z.number().optional(),
  auditionId: z.string().optional(),
  commissionListingId: z.string().optional(),
  auditionAnnounceKind: AuditionAnnounceKindSchema.optional(),
});
export type SquareStreetzPostPayload = z.infer<typeof SquareStreetzPostPayloadSchema>;

export const MentionHistoryItemSchema = MentionSchema.extend({ viewedAt: z.number() });
export type MentionHistoryItem = z.infer<typeof MentionHistoryItemSchema>;

export const MentionHistoryDocumentSchema = z.object({
  userId: z.string(),
  items: z.array(MentionHistoryItemSchema),
});
export type MentionHistoryDocument = z.infer<typeof MentionHistoryDocumentSchema>;

// Declared here, not in schemas/social.ts: the reverse import would be a module cycle.
export const AddToMentionHistoryResultSchema = z.object({
  success: z.literal(true),
  itemCount: z.number().int().nonnegative(),
  items: z.array(MentionHistoryItemSchema),
});
export type AddToMentionHistoryResult = z.infer<typeof AddToMentionHistoryResultSchema>;

export const FollowEdgeSchema = z.object({
  followerUid: z.string(),
  targetType: FollowableTargetTypeSchema,
  targetId: z.string(),
  followedOn: z.number(),
});
export type FollowEdge = z.infer<typeof FollowEdgeSchema>;

export const FollowCounterSchema = z.object({
  followerCount: z.number(),
  updatedOn: z.number(),
});
export type FollowCounter = z.infer<typeof FollowCounterSchema>;

export const SquareStreetzLikeSchema = z.object({
  likedOn: z.number(),
});
export type SquareStreetzLike = z.infer<typeof SquareStreetzLikeSchema>;

export const TrendingPostsSchema = z.object({
  postIds: z.array(z.string()),
  lastUpdated: z.number(),
});
export type TrendingPosts = z.infer<typeof TrendingPostsSchema>;
