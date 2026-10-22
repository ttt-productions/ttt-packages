import { FOUNDING_WORK_HOLDER_TYPE } from '../doc-schemas/work-project.js';
import type { GuildmateUser, PublicGuildmateUser } from '../doc-schemas/work-project.js';

export const GUILDMATE_USER_PUBLIC_FIELDS: readonly (keyof GuildmateUser)[] = [
  'uid',
  'tradeProfessions',
  'joinedAt',
  'status',
];

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
