import { z } from "zod";

// DomainEvent schemas for the user/identity domain — profile, craft skills,
// follows, mentions, and auth status. Assembled into the discriminated union in
// ./domain-events.ts.

export const ProfilePictureUpdatedEventSchema = z
  .object({
    type: z.literal('profile.pictureUpdated'),
    ids: z.object({ userId: z.string().min(1) }).strict(),
  })
  .strict();

export const ProfilePreferencesUpdatedEventSchema = z
  .object({
    type: z.literal('profile.preferencesUpdated'),
    ids: z
      .object({
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CraftSkillCreatedEventSchema = z
  .object({
    type: z.literal('craftSkill.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        craftSkillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CraftSkillUpdatedEventSchema = z
  .object({
    type: z.literal('craftSkill.updated'),
    ids: z
      .object({
        userId: z.string().min(1),
        craftSkillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CraftSkillDeletedEventSchema = z
  .object({
    type: z.literal('craftSkill.deleted'),
    ids: z
      .object({
        userId: z.string().min(1),
        craftSkillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const FollowCreatedEventSchema = z
  .object({
    type: z.literal('follow.created'),
    ids: z
      .object({
        followerUid: z.string().min(1),
        targetType: z.enum(['user', 'workProject', 'workRealm']),
        targetId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const FollowRemovedEventSchema = z
  .object({
    type: z.literal('follow.removed'),
    ids: z
      .object({
        followerUid: z.string().min(1),
        targetType: z.enum(['user', 'workProject', 'workRealm']),
        targetId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const MentionReadEventSchema = z
  .object({
    type: z.literal('mention.read'),
    ids: z
      .object({
        userId: z.string().min(1),
        mentionId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AuthStatusChangedEventSchema = z
  .object({
    type: z.literal('auth.statusChanged'),
    ids: z
      .object({
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();
