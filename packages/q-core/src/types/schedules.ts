export const SCHEDULE_CONFLICT_KIND_KEYS = ['sharedLocation', 'teamDoubleBooked'] as const;
export type ScheduleConflictKind = (typeof SCHEDULE_CONFLICT_KIND_KEYS)[number];
export const SHARED_LOCATION_CONFLICT = 'sharedLocation' as const satisfies ScheduleConflictKind;
export const TEAM_DOUBLE_BOOKED_CONFLICT =
  'teamDoubleBooked' as const satisfies ScheduleConflictKind;

export const SPORT_GAME_DELETION_SCOPE_KEYS = ['game', 'week', 'team'] as const;
export type SportGameDeletionScope = (typeof SPORT_GAME_DELETION_SCOPE_KEYS)[number];

export const SPORT_GAME_SCHEDULE_FIELD_KEYS = [
  'weekId',
  'teams',
  'startTime',
  'gameLocationId',
  'subLocation',
  'locationLabel',
] as const;
export type SportGameScheduleField = (typeof SPORT_GAME_SCHEDULE_FIELD_KEYS)[number];

export const SCHEDULE_WEEK_FIELD_KEYS = ['weekTitle', 'weekStartDate', 'weekLocation'] as const;
export type ScheduleWeekField = (typeof SCHEDULE_WEEK_FIELD_KEYS)[number];

export const SCHEDULE_REFUSAL_REASON_KEYS = [
  'gameCompleted',
  'gameHeld',
  'weekHasCompletedGames',
  'teamHasRecordedStats',
  'gameHasRecordedPlay',
] as const;
export type ScheduleRefusalReason = (typeof SCHEDULE_REFUSAL_REASON_KEYS)[number];
