// User-related Firestore document SCHEMAS — the single source of truth for the
// `userProfiles/{uid}` doc, its `privateData/{uid}` subdoc, and craft-skill shapes.
// (The `publicUsers/{uid}` mirror lives in ./publicUser.) TypeScript types are
// inferred from these schemas via `z.infer`, so a document's shape and its type
// cannot drift apart. See docs/design/firestore-schema-registry.md (ttt-prod).

import { z } from 'zod';
import { HALL_WING_TYPE_KEYS } from '../types/content.js';

const mediaKindSchema = z.enum(['image', 'video', 'audio']);

export const CraftSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  tags: z.array(z.string()),
  createdAt: z.number(),
  type: mediaKindSchema,
});
export type CraftSkill = z.infer<typeof CraftSkillSchema>;

export const CraftSkillReferenceSchema = z.object({
  craftSkillId: z.string(),
  compositeId: z.string(),
  userId: z.string(),
  craftSkillName: z.string(),
  craftSkillUrl: z.string(),
  craftSkillType: mediaKindSchema,
  tags: z.array(z.string()),
  createdAt: z.number(),
});
export type CraftSkillReference = z.infer<typeof CraftSkillReferenceSchema>;

export const MinimalCraftSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  type: mediaKindSchema,
});
export type MinimalCraftSkill = z.infer<typeof MinimalCraftSkillSchema>;

export const OwnedWorkProjectSchema = z.object({
  workProjectId: z.string(),
  workingTitle: z.string(),
  workingDescription: z.string(),
  type: z.string(),
  createdOn: z.number(),
  hallWingType: z.enum(HALL_WING_TYPE_KEYS),
});
export type OwnedWorkProject = z.infer<typeof OwnedWorkProjectSchema>;

export const AssociatedWorkProjectSchema = z.object({
  workProjectId: z.string(),
  workingTitle: z.string(),
  workingDescription: z.string(),
  type: z.string(),
  joinedOn: z.number(),
});
export type AssociatedWorkProject = z.infer<typeof AssociatedWorkProjectSchema>;

export const FullUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  profilePictureUrlFull: z.string().nullable().optional(),
  profilePictureUrlMedium: z.string().nullable().optional(),
  profilePictureUrlSmall: z.string().nullable().optional(),
  artisanCreator: z.number().optional(),
  status: z.enum(['active', 'disabled', 'banned']).optional(),
  ownedWorkProjects: z.array(OwnedWorkProjectSchema).optional(),
  associatedWorkProjects: z.array(AssociatedWorkProjectSchema).optional(),
  createdAt: z.number(),
});
export type FullUser = z.infer<typeof FullUserSchema>;

export const UserAgreementsSchema = z.object({
  age: z.boolean().optional(),
  nudity: z.boolean().optional(),
  meet: z.boolean().optional(),
  cookies: z.boolean().optional(),
  terms: z.boolean().optional(),
  agreedOn: z.number().optional(),
});
export type UserAgreements = z.infer<typeof UserAgreementsSchema>;

/**
 * Owner-only account state at `userProfiles/{uid}/privateData/{uid}` (readable
 * only by the owner; never mirrored to publicUsers).
 */
export const UserPrivateDataSchema = z.object({
  email: z.string(),
  isWaitingForNewsApproval: z.boolean().optional(),
  squareStreetzAgreementsDate: z.number().optional(),
  agreements: UserAgreementsSchema.optional(),
});
export type UserPrivateData = z.infer<typeof UserPrivateDataSchema>;
