// Project-related Firestore document types

import type { ShortUser } from './user.js';
import type { LibraryItemType } from './content.js';

export type ActiveUsers = {
  uid: string;
  displayName: string;
  sharesNumber: number;
  roles: string[];
  professions: string[];
};

export type ShortProject = {
  projectId: string;
  type: string;
  workingDescription: string;
  workingTitle: string;
};

export type ProjectFile = {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  size: number;
  type: string;
  createdBy: ShortUser;
};

export type ProjectRolesMap = {
  [key: string]: { [uid: string]: true };
};

export type ProjectProfessionsMap = {
  [key: string]: { [uid: string]: true };
};

export type PendingShares = {
  [sourceId: string]: {
    amount: number;
    type: 'invite' | 'job';
    createdAt: number;
  };
};

export type FullProject = {
  projectId: string;
  createdOn: number;
  type: string;
  workingDescription: string;
  workingTitle: string;
  libraryType: LibraryItemType;
  createdBy: ShortUser;
  ownedBy: ShortUser;
  status: 'open' | 'pendingVerification' | 'published' | 'rejected';
  activeUsers?: ActiveUsers[];
  activeUserIds?: { [key: string]: boolean };
  invitedUserIds?: { [key: string]: boolean };
  roles?: ProjectRolesMap;
  professionMap?: ProjectProfessionsMap;
  files?: ProjectFile[];
  universeId?: string;
  origin?: 'newUniverse' | 'existingUniverse' | 'standalone';
  pendingShares?: PendingShares;
};

export type PublicProject = {
  projectId: string;
  createdOn: number;
  type: string;
  workingTitle: string;
  workingDescription: string;
  ownedBy: ShortUser;
  followerCount: number;
  viewCount: number;
};

export type Universe = {
  universeId: string;
  workingTitle: string;
  workingDescription: string;
  createdOn: number;
  createdBy: ShortUser;
  ownedBy: ShortUser;
  type: string;
  projectIds: string[];
};

export type ProjectShareEntry = {
  shares: number;
};

export type ProjectInvite = {
  inviteId: string;
  createdBy: ShortUser;
  createdOn: number;
  message: string;
  project: ShortProject;
  status: 'pending' | 'accepted' | 'declined';
  lastUpdatedAt: number;
};

export type ShareOperationType =
  | 'add-pending'
  | 'remove-pending'
  | 'add-active'
  | 'create-project'
  | 'convert-invite';

export type ShareOperation = {
  type: ShareOperationType;
  amount?: number;
  user?: { uid: string; displayName: string };
  sourceId?: string;
  sourceType?: 'invite' | 'job';
  projectData?: FullProject;
};
