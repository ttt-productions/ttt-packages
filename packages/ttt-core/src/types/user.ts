// User-related Firestore document types

export type ShortUser = {
  uid: string;
  displayName: string;
  profilePictureUrlMedium?: string | null;
};

export type Skill = {
  id: string;
  name: string;
  url: string;
  tags: string[];
  createdAt: number;
  type: 'image' | 'video' | 'audio';
};

export type SkillReference = {
  skillId: string;
  compositeId: string;
  userId: string;
  displayName: string;
  skillName: string;
  skillUrl: string;
  skillType: 'image' | 'video' | 'audio';
  tags: string[];
  createdAt: number;
};

export interface MinimalSkill {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio';
}

export type OwnedProject = {
  projectId: string;
  workingTitle: string;
  workingDescription: string;
  type: string;
  createdOn: number;
  libraryType: LibraryItemType;
};

export type AssociatedProject = {
  projectId: string;
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
  creator?: string;
  status?: 'active' | 'disabled' | 'banned';
  ownedProjects?: OwnedProject[];
  associatedProjects?: AssociatedProject[];
  isWaitingForNewsApproval?: boolean;
  createdAt: number;
  streetzAgreementsDate?: number;
};

export type AllFollows = {
  allFollowedUsers: ShortUser[];
};
