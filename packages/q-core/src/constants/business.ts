export const MIN_DISPLAY_NAME_LENGTH = 3;
export const MAX_DISPLAY_NAME_LENGTH = 50;
// The shortest password an account takes: Firebase Auth's own floor.
export const PASSWORD_MIN_LENGTH = 6;
export const MIN_TEAM_NAME_LENGTH = 3;
export const MAX_TEAM_NAME_LENGTH = 50;

export const MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH = 10;
export const MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH = 500;
export const MAX_TEAM_INVITATION_MESSAGE_LENGTH = 500;

export const MIN_LEAGUE_TITLE_LENGTH = 3;
export const MAX_LEAGUE_TITLE_LENGTH = 100;
export const MIN_LEAGUE_DESCRIPTION_LENGTH = 10;
export const MAX_LEAGUE_DESCRIPTION_LENGTH = 5000;
export const HARDWARE_CATALOG = [
  { id: 'ipad', name: 'iPad' },
  { id: 'ipad-charger', name: 'iPad Charger' },
] as const;
export type HardwareCatalogItemId = (typeof HARDWARE_CATALOG)[number]['id'];
export const HARDWARE_CATALOG_ITEM_IDS = HARDWARE_CATALOG.map((item) => item.id) as [
  HardwareCatalogItemId,
  ...HardwareCatalogItemId[],
];

export const MIN_AWARD_NAME_LENGTH = 3;
export const MAX_AWARD_NAME_LENGTH = 60;

export const MAX_AWARD_GRANT_TARGETS = 20;
export const AWARD_GROUP_GRANT_PAGE_SIZE = 100;

export const MIN_REPAIR_REASON_LENGTH = 3;
export const MAX_REPAIR_REASON_LENGTH = 500;

export const MAX_ADMIN_LIST_CHANGES = 20;

export const TEAM_CREATION_CUTOFF_DAYS = 14;

export const MAX_CONTACT_PHONE_LENGTH = 30;

export const MAX_ROSTER_SYNC_FAILURE_MESSAGE_LENGTH = 500;

export const MAX_MAINTENANCE_MESSAGE_LENGTH = 2000;
export const MAX_ANNOUNCEMENT_MESSAGE_LENGTH = 300;
export const MAX_APP_VERSION_LENGTH = 64;

export const MAX_LANDING_HERO_TITLE_LENGTH = 200;
export const MAX_LANDING_ABOUT_TEXT_LENGTH = 5000;

export const MAX_WAIVER_TEMPLATE_TITLE_LENGTH = 120;
export const MAX_WAIVER_TEMPLATE_TEXT_LENGTH = 20000;

export const MAX_GAME_LOCATION_NAME_LENGTH = 100;
export const MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH = 200;
export const MAX_GAME_LOCATION_SUB_LOCATIONS = 50;
export const MAX_GAME_LOCATION_SUB_LOCATION_LENGTH = 60;
export const MAX_GAME_LOCATION_MEMO_LENGTH = 500;

export const MAX_SCHEDULE_WEEK_TITLE_LENGTH = 100;

export const LEAGUE_TIME_ZONE = 'America/New_York';

export const MAX_GAME_MEMO_LENGTH = 30;

export const countCapReachedMessage = (subject: string, limit: number, noun: string): string =>
  `${subject} already has the maximum of ${limit} ${noun}.`;

export const MAX_ACTIVE_TEAM_MEMBERS = 30;
export const TEAM_FULL_MESSAGE = countCapReachedMessage(
  'This team',
  MAX_ACTIVE_TEAM_MEMBERS,
  'players',
);
export const MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM = MAX_ACTIVE_TEAM_MEMBERS;
export const MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM = 10;
export const MAX_ROSTER_ENTRIES_PER_TEAM =
  MAX_ACTIVE_TEAM_MEMBERS + MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM;
export const scheduledGameLabel = (weekTitle: string, dayKey: string): string =>
  `The ${weekTitle} game on ${dayKey}`;
export const gameSideFullMessage = (gameLabel: string): string =>
  countCapReachedMessage(gameLabel, MAX_ROSTER_ENTRIES_PER_TEAM, "people on this team's side");
export const gameSideDepartedFullMessage = (gameLabel: string): string =>
  `${gameLabel} already keeps the ${MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM} players a side may hold after they leave the team with stats in it. Finalize that game, or take this player's stats off it, first.`;

export const MAX_TEAMS_PER_LEAGUE = 40;
export const MAX_GAMES_PER_LEAGUE = 250;
export const LEAGUE_TEAMS_FULL_MESSAGE = countCapReachedMessage(
  'This league',
  MAX_TEAMS_PER_LEAGUE,
  'teams',
);
export const LEAGUE_GAMES_FULL_MESSAGE = countCapReachedMessage(
  'This league',
  MAX_GAMES_PER_LEAGUE,
  'games',
);

export const MAX_SCHEDULE_WEEK_GAMES = 20;
export const SCHEDULE_WEEK_FULL_MESSAGE = countCapReachedMessage(
  'This week',
  MAX_SCHEDULE_WEEK_GAMES,
  'games',
);

export const MAX_PLAYOFF_CUTOFF = MAX_TEAMS_PER_LEAGUE;

export const MAX_STAT_EVENTS_PER_GAME = 1000;
export const GAME_STAT_LOG_FULL_MESSAGE = countCapReachedMessage(
  'This game',
  MAX_STAT_EVENTS_PER_GAME,
  'recorded stats',
);

export const MAX_GAME_LOCATIONS = 30;
export const GAME_LOCATIONS_FULL_MESSAGE = countCapReachedMessage(
  'Q-Sports',
  MAX_GAME_LOCATIONS,
  'locations',
);

export const MAX_OFFERED_WAIVER_TEMPLATES = 30;
export const WAIVER_TEMPLATES_FULL_MESSAGE = countCapReachedMessage(
  'Q-Sports',
  MAX_OFFERED_WAIVER_TEMPLATES,
  'waiver templates offered to leagues',
);

export const CAPACITY_LIMITS = [
  {
    key: 'teamPlayers',
    label: 'Players on a team, ghost players included',
    limit: MAX_ACTIVE_TEAM_MEMBERS,
  },
  {
    key: 'gameSidePeople',
    label: `People on one side of one game: ${MAX_ACTIVE_TEAM_MEMBERS} players plus ${MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM} who left the team after recording stats in it`,
    limit: MAX_ROSTER_ENTRIES_PER_TEAM,
  },
  { key: 'leagueTeams', label: 'Teams in a league', limit: MAX_TEAMS_PER_LEAGUE },
  {
    key: 'leagueGames',
    label: "Games in a league, so also a team's games",
    limit: MAX_GAMES_PER_LEAGUE,
  },
  { key: 'weekGames', label: 'Games in one week of the schedule', limit: MAX_SCHEDULE_WEEK_GAMES },
  { key: 'gameStats', label: 'Stats recorded in one game', limit: MAX_STAT_EVENTS_PER_GAME },
  {
    key: 'playoffCutoff',
    label: "Teams reaching the playoffs, at most the league's team limit",
    limit: MAX_PLAYOFF_CUTOFF,
  },
  {
    key: 'gameLocations',
    label: "Game locations, each venue's courts or sheets counted as part of it",
    limit: MAX_GAME_LOCATIONS,
  },
  {
    key: 'offeredWaiverTemplates',
    label: 'Waiver templates offered to leagues, retired ones not counted',
    limit: MAX_OFFERED_WAIVER_TEMPLATES,
  },
] as const satisfies readonly { key: string; label: string; limit: number }[];
export type CapacityLimitKey = (typeof CAPACITY_LIMITS)[number]['key'];
