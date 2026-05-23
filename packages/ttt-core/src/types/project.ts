// Project-related Firestore document types
export type { ShortProject } from '../media/atoms.js';

import type { LibraryItemType } from './content.js';
import type { ShortProject } from '../media/atoms.js';

export type ActiveUsers = {
  uid: string;
  sharesNumber: number;
  roles: string[];
  professions: string[];
};

export type ProjectFile = {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  size: number;
  type: string;
  createdBy: { uid: string };
};

export type ProjectRolesMap = {
  [key: string]: { [uid: string]: true };
};

export type ProjectProfessionsMap = {
  [key: string]: { [uid: string]: true };
};

export type PendingShares = {
  [inviteId: string]: {
    amount: number;
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
  createdBy: { uid: string };
  ownedBy: { uid: string };
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
  ownedBy: { uid: string };
  followerCount: number;
  viewCount: number;
};

export type Universe = {
  universeId: string;
  workingTitle: string;
  workingDescription: string;
  createdOn: number;
  createdBy: { uid: string };
  ownedBy: { uid: string };
  type: string;
  projectIds: string[];
};

export type ProjectShareEntry = {
  shares: number;
};

export type ProjectInvite = {
  inviteId: string;
  createdBy: { uid: string };
  createdOn: number;
  message: string;
  project: ShortProject;
  status: 'pending' | 'accepted' | 'declined';
  lastUpdatedAt: number;
};

// ShareOperation type and union are now defined by the Zod schema.
// See packages/ttt-core/src/schemas/share-operation.ts for the source of truth.
// The old `projectData?: FullProject` field was dead and has been removed.
export type { ShareOperation, ShareOperationType } from '../schemas/share-operation.js';
