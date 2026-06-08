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
  // Moderation visibility flag. Absent/false = visible; true = hidden by the
  // craft-skill hide cascade (report auto-hide or admin action). Mirrored onto
  // every taggedCraftSkills index doc so discovery surfaces can filter it.
  hidden: z.boolean().optional(),
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
  // Mirror of CraftSkill.hidden; lets the tag-browse filter hidden skills out.
  hidden: z.boolean().optional(),
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
  status: z.enum(['active', 'suspended', 'banned']).optional(),
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
  // Epoch ms when the user applied for news/political posting (not a boolean) so the
  // applicant queue can be ordered/triaged by application date. Mirrors the
  // `artisanCreator?: number` grant-timestamp pattern. Truthy when set, so existing
  // truthiness reads keep working; absent until the user applies.
  isWaitingForNewsApproval: z.number().optional(),
  squareStreetzAgreementsDate: z.number().optional(),
  agreements: UserAgreementsSchema.optional(),
  // Moderation: human-readable reason for the current account status (set when an
  // admin suspends/bans the user). Written by the setUserStatus callable via the
  // Admin SDK; readable only by the owner (shown in their restricted view).
  // Cleared when the account is reinstated to 'active'.
  statusReason: z.string().optional(),
  statusReasonAt: z.number().optional(),
});
export type UserPrivateData = z.infer<typeof UserPrivateDataSchema>;
