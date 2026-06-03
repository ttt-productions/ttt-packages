// User-related Firestore document types

export type CraftSkill = {
  id: string;
  name: string;
  url: string;
  tags: string[];
  createdAt: number;
  type: 'image' | 'video' | 'audio';
};

export type CraftSkillReference = {
  craftSkillId: string;
  compositeId: string;
  userId: string;
  craftSkillName: string;
  craftSkillUrl: string;
  craftSkillType: 'image' | 'video' | 'audio';
  tags: string[];
  createdAt: number;
};

export interface MinimalCraftSkill {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio';
}

export type OwnedWorkProject = {
  workProjectId: string;
  workingTitle: string;
  workingDescription: string;
  type: string;
  createdOn: number;
  hallWingType: HallWingType;
};

export type AssociatedWorkProject = {
  workProjectId: string;
  workingTitle: string;
  workingDescription: string;
  type: string;
  joinedOn: number;
};

// HallWingType forward reference — re-exported from content.ts
import type { HallWingType } from './content.js';

export type FullUser = {
  uid: string;
  displayName: string;
  displayName_lowercase: string;
  profilePictureUrlFull?: string | null;
  profilePictureUrlMedium?: string | null;
  profilePictureUrlSmall?: string | null;
  artisanCreator?: number;
  status?: 'active' | 'disabled' | 'banned';
  ownedWorkProjects?: OwnedWorkProject[];
  associatedWorkProjects?: AssociatedWorkProject[];
  createdAt: number;
};

export type UserAgreements = {
  age?: boolean;
  nudity?: boolean;
  meet?: boolean;
  cookies?: boolean;
  terms?: boolean;
  agreedOn?: number;
};

/**
 * Owner-only account state at `userProfiles/{uid}/privateData/{uid}` (readable
 * only by the owner; never mirrored to publicUsers). `isWaitingForNewsApproval`,
 * `squareStreetzAgreementsDate`, and `agreements` were relocated off the public
 * FullUser doc so other signed-in users can't read a user's approval/agreement
 * state. `status` deliberately stays on FullUser (the publicUsers mirror derives
 * `disabled` from it and the bootstrap gate reads it live).
 */
export type UserPrivateData = {
  email: string;
  isWaitingForNewsApproval?: boolean;
  squareStreetzAgreementsDate?: number;
  agreements?: UserAgreements;
};

