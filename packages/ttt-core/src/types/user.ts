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
  libraryType: LibraryItemType;
};

export type AssociatedWorkProject = {
  workProjectId: string;
  workingTitle: string;
  workingDescription: string;
  type: string;
  joinedOn: number;
};

// LibraryItemType forward reference — re-exported from content.ts
import type { LibraryItemType } from './content.js';

export type FullUser = {
  uid: string;
  displayName: string;
  displayName_lowercase: string;
  profilePictureUrlFull?: string | null;
  profilePictureUrlMedium?: string | null;
  profilePictureUrlSmall?: string | null;
  artisanCreator?: string;
  status?: 'active' | 'disabled' | 'banned';
  ownedWorkProjects?: OwnedWorkProject[];
  associatedWorkProjects?: AssociatedWorkProject[];
  isWaitingForNewsApproval?: boolean;
  createdAt: number;
  streetzAgreementsDate?: number;
};
