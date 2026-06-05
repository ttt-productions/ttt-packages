// WorkProject-related Firestore document types
export type { ShortWorkProject } from '../media/atoms.js';

import type { GuildmateUser } from '../doc-schemas/work-project.js';

export type {
  GuildmateStatus,
  GuildmateUser,
  PublicGuildmateUser,
  WorkAsset,
  PendingStakeShares,
  FullWorkProject,
  PublicWorkProject,
  WorkRealm,
} from '../doc-schemas/work-project.js';

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

// StakeShareOperation types are defined by the Zod schema.
// See packages/ttt-core/src/schemas/stake-share-operation.ts for the source of truth.
// The old `workProjectData?: FullWorkProject` field was dead and has been removed.
export type { StakeShareOperation, StakeShareOperationType } from '../schemas/stake-share-operation.js';
