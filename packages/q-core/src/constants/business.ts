// Business limits and policy values both app roots enforce. A form reads these for its
// `maxLength` / zod bound and the callable's input schema reads the same constant (ENG-005).

// Display names, team names, and ghost player names share one length policy.
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
// How many teams in a pool reach the playoffs. The cap only bounds the input: no league comes near
// it, and a cutoff above a pool's team count simply admits every team.
export const MAX_PLAYOFF_CUTOFF = 100;
// The equipment a referee can be loaned. The catalog is this constant: adding an item is a code
// change, and a contract records each item's id and name as it was loaned.
export const HARDWARE_CATALOG = [
  { id: 'ipad', name: 'iPad' },
  { id: 'ipad-charger', name: 'iPad Charger' },
] as const;
export type HardwareCatalogItemId = (typeof HARDWARE_CATALOG)[number]['id'];
export const HARDWARE_CATALOG_ITEM_IDS = HARDWARE_CATALOG.map((item) => item.id) as [
  HardwareCatalogItemId,
  ...HardwareCatalogItemId[],
];

// An award's name in the catalog.
export const MIN_AWARD_NAME_LENGTH = 3;
export const MAX_AWARD_NAME_LENGTH = 60;

// The most people one award grant may reach once its teams and leagues are resolved to their active
// members: every grant of one call commits in one transaction, beside its audit events.
export const MAX_AWARD_GRANT_RECIPIENTS = 200;
// The most users, teams, or leagues one award grant call may name in each list.
export const MAX_AWARD_GRANT_TARGETS = 20;

// The reason an admin gives for a repair action — a backfill, a recalculation, a reopen — recorded on
// its audit event (BACKEND-212).
export const MIN_REPAIR_REASON_LENGTH = 3;
export const MAX_REPAIR_REASON_LENGTH = 500;

// The most uids one `updateAdminList` call may grant or revoke per list.
export const MAX_ADMIN_LIST_CHANGES = 20;

// A team may be created in a league until this many days after the league's start date.
export const TEAM_CREATION_CUTOFF_DAYS = 14;

// Contact phone numbers are stored as typed, bounded only in length.
export const MAX_CONTACT_PHONE_LENGTH = 30;

// The failure a roster obligation records when a reconciliation run fails, cut to this length.
export const MAX_ROSTER_SYNC_FAILURE_MESSAGE_LENGTH = 500;

// `_appConfig/app` operator messages.
export const MAX_MAINTENANCE_MESSAGE_LENGTH = 2000;
export const MAX_ANNOUNCEMENT_MESSAGE_LENGTH = 300;
// `_appConfig/app.appVersion` — the version a live client compares itself against.
export const MAX_APP_VERSION_LENGTH = 64;

// `_appConfig/landingPage` copy.
export const MAX_LANDING_HERO_TITLE_LENGTH = 200;
export const MAX_LANDING_ABOUT_TEXT_LENGTH = 5000;

// Waiver template wording. A signed waiver carries its own copy of the title and text, so the text
// cap also bounds every signature document.
export const MAX_WAIVER_TEMPLATE_TITLE_LENGTH = 120;
export const MAX_WAIVER_TEMPLATE_TEXT_LENGTH = 20000;

// Game locations: the venue, its address, the courts or sheets inside it, and the directions memo.
export const MAX_GAME_LOCATION_NAME_LENGTH = 100;
export const MAX_GAME_LOCATION_STREET_ADDRESS_LENGTH = 200;
export const MAX_GAME_LOCATION_SUB_LOCATIONS = 50;
export const MAX_GAME_LOCATION_SUB_LOCATION_LENGTH = 60;
export const MAX_GAME_LOCATION_MEMO_LENGTH = 500;

// A week of the schedule: its title, and the games one save creates with it — each seeded with its
// teams' rosters in the same transaction, so a larger week is saved in parts.
export const MAX_SCHEDULE_WEEK_TITLE_LENGTH = 100;
export const MAX_SCHEDULE_WEEK_GAMES = 20;

// The timezone a game's `dayKey` (its local calendar date) is computed in.
export const LEAGUE_TIME_ZONE = 'America/New_York';

// A scorer's note on one person in a game ("red shirt", "#9").
export const MAX_GAME_MEMO_LENGTH = 30;


// How a refusal at a count cap reads: the thing that is full, its limit, and what it holds.
export const countCapReachedMessage = (subject: string, limit: number, noun: string): string =>
  `${subject} already has the maximum of ${limit} ${noun}.`;

// A team's size. Every way onto a team is refused at this many active members, inside the
// admission's transaction, so a game's roster can always be seeded and checked in one read.
export const MAX_ACTIVE_TEAM_MEMBERS = 100;
export const TEAM_FULL_MESSAGE = countCapReachedMessage('This team', MAX_ACTIVE_TEAM_MEMBERS, 'members');
// The memberships one game-roster seed reads for a team: every membership is active, so the cap.
export const MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM = MAX_ACTIVE_TEAM_MEMBERS;
// Departed players a team's side of an open game may keep beside its members: a player who recorded
// stats in the game keeps their entry after leaving the team.
export const MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM = 20;
// The entries one team's side of a game may hold, so a reconcile or finalize reads them in one page.
export const MAX_ROSTER_ENTRIES_PER_TEAM = MAX_ACTIVE_TEAM_MEMBERS + MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM;

// A league's size. Standings, schedules, and rankings need a league's complete set of teams and
// games, so creation is refused at these caps rather than any read being cut short. The team cap is
// also the most teams one mode switch rewrites in its one transaction.
export const MAX_TEAMS_PER_LEAGUE = 498;
export const MAX_GAMES_PER_LEAGUE = 1000;
export const LEAGUE_TEAMS_FULL_MESSAGE = countCapReachedMessage('This league', MAX_TEAMS_PER_LEAGUE, 'teams');
export const LEAGUE_GAMES_FULL_MESSAGE = countCapReachedMessage('This league', MAX_GAMES_PER_LEAGUE, 'games');

// A game's stat log. A write that would take a game's `statEventSequence` past it is refused with
// nothing written, which also bounds the game's live play-by-play.
export const MAX_STAT_EVENTS_PER_GAME = 5000;
export const GAME_STAT_LOG_FULL_MESSAGE = countCapReachedMessage('This game', MAX_STAT_EVENTS_PER_GAME, 'recorded stats');
