import {
  GUILD_STANDINGS,
  GUILD_STANDING_IDS,
  GUILD_STANDING_VALUE_BY_ID,
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
