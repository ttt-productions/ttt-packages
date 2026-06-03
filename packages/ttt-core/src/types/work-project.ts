// WorkProject-related Firestore document types
export type { ShortWorkProject } from '../media/atoms.js';

import type { HallWingType, WorkProjectType } from './content.js';
import type { ShortWorkProject } from '../media/atoms.js';
import type { GuildStandingId } from '../permissions/index.js';

export type GuildmateStatus = 'active' | 'departed';

export type GuildmateUser = {
  uid: string;
  guildStandings: GuildStandingId[];
  tradeProfessions: string[];
  stakeShareCount: number;
  joinedAt: number;
  status: GuildmateStatus;
  /**
   * Holder kind for this stake entry. Absent/`'user'` = a real guildmate person.
   * `'foundingWork'` = the realm founding-Work holder (keyed by the founding
   * workProjectId, NOT a user uid) that holds EXISTING_REALM_STAKE_SHARES in a
   * Work created into an existing public realm. Distribution of those shares is
   * resolved through the founding Work's own ledger; no split fields here.
   */
  holderType?: 'user' | 'foundingWork';
};

/**
 * Public projection of a guildmate, mirrored to
 * `allWorkProjects/{workProjectId}/publicGuildmateUsers/{uid}` for signed-in
 * read on public Work / Hall pages. Person guildmates only — founding-work
 * holders are excluded. Display name/avatar resolve from `publicUsers/{uid}`;
 * the steward is identified via `publicWorkProjects.ownerUid`. Never carries
 * `stakeShareCount` or any private invite/share field.
 */
export type PublicGuildmateUser = {
  uid: string;
  tradeProfessions: string[];
  joinedAt: number;
  status: GuildmateStatus;
};

/**
 * Single source of truth for which GuildmateUser fields the public mirror copies,
 * so the mirror trigger can't drift from the PublicGuildmateUser shape.
 */
export const GUILDMATE_USER_PUBLIC_FIELDS: readonly (keyof GuildmateUser)[] = [
  'uid',
  'tradeProfessions',
  'joinedAt',
  'status',
];

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
  workRealmId: string;
  realmCanonStatus: 'canon' | 'nonCanon';
  pendingStakeShares?: PendingStakeShares;
};

// Top-level safe signed-in-user Work shell / search projection. Server/callable-written only.
// No counts, no child arrays, no copied Realm title or owner display name.
export type PublicWorkProject = {
  workProjectId: string;
  publicWorkStatus: 'draft' | 'released';
  publicWorkHidden: boolean;
  workRealmId: string;
  realmCanonStatus: 'canon' | 'nonCanon';
  type: WorkProjectType;
  hallWingType: HallWingType;
  workingTitle: string;
  workingTitle_lowercase: string;
  workingDescription: string;
  coverImageUrl?: string;
  ownerUid: string;
  createdByUid: string;
  createdOn: number;
  updatedOn: number;
};

// Realm source of truth and Realm search/tag surface. Server/callable-written only.
// No workProjectIds[], no counts, no images, no release timestamp (audit events hold timing).
export type WorkRealm = {
  workRealmId: string;
  realmType: 'public' | 'standalone';
  realmStatus: 'draft' | 'released';
  realmHidden: boolean;
  workingTitle: string;
  workingTitle_lowercase: string;
  workingDescription: string;
  ownerUid: string;
  createdByUid: string;
  foundingWorkProjectId: string;
  createdOn: number;
  updatedOn: number;
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
