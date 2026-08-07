// WorkProject-related Firestore document types
import { FOUNDING_WORK_HOLDER_TYPE } from '../doc-schemas/work-project.js';
import type { GuildmateUser, PublicGuildmateUser } from '../doc-schemas/work-project.js';

export type {
  GuildmateStatus,
  GuildmateUser,
  PublicGuildmateUser,
  WorkFileFolder,
  WorkFile,
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

/**
 * Build the public collaborator projection from a raw guildmate document. THE single
 * owner of this projection — the mirror trigger and the post-deploy backfill both call
 * it, so the privacy boundary cannot drift between them.
 *
 * Returns null (meaning "no public doc") for missing data (guildmate doc deleted) and
 * for the founding-Work holder. A `departed` guildmate IS projected, keeping historical
 * collaborator credit; only a hard-deleted guildmate doc removes the projection.
 *
 * Projects exactly `GUILDMATE_USER_PUBLIC_FIELDS`. `tradeProfessions` is a
 * company-controlled enum and safe to expose; guild standings and stake counts are NOT
 * projected. The return type is `PublicGuildmateUser`, so a field added to
 * `PublicGuildmateUserSchema` breaks this function at compile time rather than silently
 * shipping an unprojected field.
 */
export function buildPublicGuildmateUserPayload(
  uid: string,
  guildmateData: Record<string, unknown> | undefined | null,
): PublicGuildmateUser | null {
  if (!guildmateData) return null;
  if (guildmateData.holderType === FOUNDING_WORK_HOLDER_TYPE) return null;

  return {
    uid,
    tradeProfessions: Array.isArray(guildmateData.tradeProfessions)
      ? (guildmateData.tradeProfessions as string[])
      : [],
    joinedAt: typeof guildmateData.joinedAt === 'number' ? guildmateData.joinedAt : 0,
    status: guildmateData.status as PublicGuildmateUser['status'],
  };
}

/** Change detection for the public roster mirror — skips a write when nothing changed. */
export function publicGuildmateUserPayloadEqual(
  a: PublicGuildmateUser | null,
  b: PublicGuildmateUser | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.uid === b.uid &&
    a.status === b.status &&
    a.joinedAt === b.joinedAt &&
    a.tradeProfessions.length === b.tradeProfessions.length &&
    a.tradeProfessions.every((profession, index) => profession === b.tradeProfessions[index])
  );
}

// StakeShareOperation types are defined by the Zod schema.
// See packages/ttt-core/src/schemas/stake-share-operation.ts for the source of truth.
// The old `workProjectData?: FullWorkProject` field was dead and has been removed.
export type { StakeShareOperation, StakeShareOperationType } from '../schemas/stake-share-operation.js';
