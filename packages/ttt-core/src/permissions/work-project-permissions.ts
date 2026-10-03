import {
  GUILD_STANDINGS,
  GUILD_STANDING_IDS,
  GUILD_STANDING_VALUE_BY_ID,
  STEWARD_OWNER_GUILD_STANDING_ID,
  WORK_FILE_ADMIN_GUILD_STANDING_IDS,
  WORK_PROJECT_ACTIONS,
  WORK_PROJECT_ACTION_IDS,
  type GuildStandingId,
  type GuildStandingValue,
  type WorkProjectActionId,
} from "./work-project-permissions-data.js";

// Re-export the standings/actions data catalog so the published permissions
// surface is unchanged after the data/logic split.
export * from "./work-project-permissions-data.js";

const GUILD_STANDING_ID_BY_VALUE = Object.fromEntries(
  GUILD_STANDING_IDS.map((guildStandingId) => [GUILD_STANDING_VALUE_BY_ID[guildStandingId], guildStandingId]),
) as Record<GuildStandingValue, GuildStandingId>;

export function isGuildStandingId(value: unknown): value is GuildStandingId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GUILD_STANDINGS, value);
}

/**
 * True when a `GuildmateUser.guildStandings` array (standing IDs) carries the steward
 * standing. The one predicate for "is this member the work steward" — callers must not
 * re-quote the member, and must not test it against a standing VALUE ('Steward').
 */
export function hasStewardOwnerStanding(guildStandings: readonly string[] | null | undefined): boolean {
  return guildStandings?.includes(STEWARD_OWNER_GUILD_STANDING_ID) === true;
}

export function isGuildStandingValue(value: unknown): value is GuildStandingValue {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GUILD_STANDING_ID_BY_VALUE, value);
}

export function getGuildStandingIdFromValue(guildStandingValue: GuildStandingValue): GuildStandingId {
  return GUILD_STANDING_ID_BY_VALUE[guildStandingValue];
}

export function getGuildStandingValueFromId(guildStandingId: GuildStandingId): GuildStandingValue {
  return GUILD_STANDING_VALUE_BY_ID[guildStandingId];
}

export function isWorkProjectActionId(value: unknown): value is WorkProjectActionId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(WORK_PROJECT_ACTIONS, value);
}

export function getActionsForGuildStanding(guildStandingId: GuildStandingId): WorkProjectActionId[] {
  return WORK_PROJECT_ACTION_IDS.filter((action) =>
    (WORK_PROJECT_ACTIONS[action].grantedTo as readonly GuildStandingId[]).includes(guildStandingId)
  );
}

/**
 * Whether a standing set grants a Work action — the one reading of `WORK_PROJECT_ACTIONS`'
 * grants. It answers for the standings alone: the active-Guildmate floor (an active guildmate
 * doc and membership) is the caller's check, made before this one.
 */
export function guildStandingsGrantAction(
  guildStandings: readonly string[] | null | undefined,
  action: WorkProjectActionId,
): boolean {
  const grantedTo = WORK_PROJECT_ACTIONS[action].grantedTo as readonly string[];
  return guildStandings?.some((standing) => grantedTo.includes(standing)) === true;
}

/**
 * Whether a Guildmate administers the Work's file system: active, and holding one of
 * `WORK_FILE_ADMIN_GUILD_STANDING_IDS`. A file admin's access overrides every folder's
 * trade-profession lists.
 */
export function isWorkFileAdmin(member: {
  status: string;
  guildStandings: readonly string[];
}): boolean {
  if (member.status !== 'active') return false;
  return member.guildStandings.some((standing) =>
    (WORK_FILE_ADMIN_GUILD_STANDING_IDS as readonly string[]).includes(standing),
  );
}
