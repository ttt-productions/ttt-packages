// WorkProject-related Firestore document types
export type { ShortProject } from '../media/atoms.js';

import type { LibraryItemType } from './content.js';
import type { ShortProject } from '../media/atoms.js';
import type { ProjectRoleId } from '../permissions/index.js';

export type ProjectMemberStatus = 'active' | 'departed';

export type ProjectMember = {
  uid: string;
  displayName: string;
  roles: ProjectRoleId[];
  tradeProfessions: string[];
  sharesNumber: number;
  joinedAt: number;
  status: ProjectMemberStatus;
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
  status: 'open' | 'pendingVerification' | 'published' | 'rejected';
  activeUserIds?: { [key: string]: boolean };
  invitedUserIds?: { [key: string]: boolean };
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
  followerCount: number;
  viewCount: number;
};

export type WorkRealm = {
  universeId: string;
  workingTitle: string;
  workingDescription: string;
  createdOn: number;
  createdBy: { uid: string };
  type: string;
  projectIds: string[];
};

export type ProjectInvite = {
  inviteId: string;
  createdBy: { uid: string };
  createdOn: number;
  message: string;
  workProject: ShortProject;
  status: 'pending' | 'accepted' | 'declined';
  lastUpdatedAt: number;
};

// ShareOperation type and union are now defined by the Zod schema.
// See packages/ttt-core/src/schemas/share-operation.ts for the source of truth.
// The old `projectData?: FullProject` field was dead and has been removed.
export type { ShareOperation, ShareOperationType } from '../schemas/share-operation.js';
