// Canonical unions of a league's schedule: its weeks and the games in them (RULE-STD-ARCH-102).

// The two kinds of scheduling conflict the week form warns about, never blocks on: two games at one
// venue court at one start time, and one team booked into two games at one start time.
export const SCHEDULE_CONFLICT_KIND_KEYS = ['sharedLocation', 'teamDoubleBooked'] as const;
export type ScheduleConflictKind = (typeof SCHEDULE_CONFLICT_KIND_KEYS)[number];
export const SHARED_LOCATION_CONFLICT = 'sharedLocation' as const satisfies ScheduleConflictKind;
export const TEAM_DOUBLE_BOOKED_CONFLICT =
  'teamDoubleBooked' as const satisfies ScheduleConflictKind;

// What a game's deletion was part of: the game alone, its whole week, or its team's deletion. The
// deletion's audit event records it.
export const SPORT_GAME_DELETION_SCOPE_KEYS = ['game', 'week', 'team'] as const;
export type SportGameDeletionScope = (typeof SPORT_GAME_DELETION_SCOPE_KEYS)[number];

// A game's schedule fields an admin edits, in the order the edit's result and audit event list them.
export const SPORT_GAME_SCHEDULE_FIELD_KEYS = [
  'weekId',
  'teams',
  'startTime',
  'gameLocationId',
  'subLocation',
  'locationLabel',
] as const;
export type SportGameScheduleField = (typeof SPORT_GAME_SCHEDULE_FIELD_KEYS)[number];

// The fields a week carries on every one of its games, which the week edit rewrites together.
export const SCHEDULE_WEEK_FIELD_KEYS = ['weekTitle', 'weekStartDate', 'weekLocation'] as const;
export type ScheduleWeekField = (typeof SCHEDULE_WEEK_FIELD_KEYS)[number];

// Why the schedule callables refused, carried in the refusal's details so the admin screen can mark
// the games it names.
export const SCHEDULE_REFUSAL_REASON_KEYS = [
  'gameCompleted',
  'gameHeld',
  'weekHasCompletedGames',
  'teamHasRecordedStats',
  'gameHasRecordedPlay',
] as const;
export type ScheduleRefusalReason = (typeof SCHEDULE_REFUSAL_REASON_KEYS)[number];
