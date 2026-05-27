// WorkProject-related Firestore document types
export type { ShortWorkProject } from '../media/atoms.js';

import type { HallWingType } from './content.js';
import type { ShortWorkProject } from '../media/atoms.js';
import type { GuildStandingId } from '../permissions/index.js';

export type GuildmateStatus = 'active' | 'departed';

export type GuildmateUser = {
  uid: string;
  displayName: string;
  guildStandings: GuildStandingId[];
  tradeProfessions: string[];
  stakeShareCount: number;
  joinedAt: number;
  status: GuildmateStatus;
};

export type WorkAsset = {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  size: number;
  type: string;
  createdBy: { uid: string };
};

export type PendingStakeShares = {
  [guildInviteId: string]: {
    amount: number;
    createdAt: number;
  };
};

export type FullWorkProject = {
  workProjectId: string;
  createdOn: number;
  type: string;
  workingDescription: string;
  workingTitle: string;
  hallWingType: HallWingType;
  createdBy: { uid: string };
  status: 'open' | 'pendingVerification' | 'published' | 'rejected';
  guildmateUserIds?: { [key: string]: boolean };
  invitedUserIds?: { [key: string]: boolean };
  workRealmId?: string;
  origin?: 'newWorkRealm' | 'existingWorkRealm' | 'standalone';
  pendingStakeShares?: PendingStakeShares;
};

export type PublicWorkProject = {
  workProjectId: string;
  createdOn: number;
  type: string;
  workingTitle: string;
  workingDescription: string;
  followerCount: number;
  viewCount: number;
};

export type WorkRealm = {
  workRealmId: string;
  workingTitle: string;
  workingDescription: string;
  createdOn: number;
  createdBy: { uid: string };
  type: string;
  workProjectIds: string[];
};

export type GuildInvite = {
  guildInviteId: string;
  createdBy: { uid: string };
  createdOn: number;
  message: string;
  workProject: ShortWorkProject;
  status: 'pending' | 'accepted' | 'declined';
  lastUpdatedAt: number;
};

// StakeShareOperation types are defined by the Zod schema.
// See packages/ttt-core/src/schemas/stake-share-operation.ts for the source of truth.
// The old `workProjectData?: FullWorkProject` field was dead and has been removed.
export type { StakeShareOperation, StakeShareOperationType } from '../schemas/stake-share-operation.js';
