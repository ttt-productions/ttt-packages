// Calendar days and times of day in the leagues' own time zone. A league's dates and a game's `dayKey`
// are calendar dates with no time or zone (`YYYY-MM-DD`), so "today" is read in LEAGUE_TIME_ZONE and
// every comparison is between two calendar dates, never between instants. A game's start is an
// instant, entered and shown as a day and a time of day (`HH:MM`) in LEAGUE_TIME_ZONE, whatever the
// zone of the browser it is entered in.

import { LEAGUE_TIME_ZONE } from '../constants/business.js';

// `en-CA` formats a date as `YYYY-MM-DD`, the stored calendar-date shape.
const LEAGUE_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: LEAGUE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar date an instant falls on in LEAGUE_TIME_ZONE. */
export function toLeagueDayKey(epochMs: number): string {
  return LEAGUE_DAY_FORMAT.format(new Date(epochMs));
}

/**
 * The calendar date `days` days after `dayKey` (before it, when negative). Pure calendar arithmetic
 * on the date itself, so no time zone or daylight-saving change moves it.
 */
export function addCalendarDays(dayKey: string, days: number): string {
  const day = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    throw new RangeError(`Not a calendar date: '${dayKey}'.`);
  }
  return new Date(day.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Every part of an instant's wall-clock reading in LEAGUE_TIME_ZONE. `h23` keeps midnight at hour 0.
const LEAGUE_WALL_CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: LEAGUE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const CALENDAR_DAY_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY_SHAPE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The instant's wall-clock reading in LEAGUE_TIME_ZONE, written as if that reading were UTC. */
function leagueWallClockAsUtc(epochMs: number): number {
  const parts = Object.fromEntries(
    LEAGUE_WALL_CLOCK_FORMAT.formatToParts(new Date(epochMs)).map((part) => [
      part.type,
      part.value,
    ]),
  );
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
}

/** The time of day an instant falls at in LEAGUE_TIME_ZONE, as `HH:MM` on a 24-hour clock. */
export function toLeagueTimeOfDay(epochMs: number): string {
  const wallClock = new Date(leagueWallClockAsUtc(epochMs));
  const hours = String(wallClock.getUTCHours()).padStart(2, '0');
  const minutes = String(wallClock.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * The instant a calendar day and a time of day (`HH:MM`, 24-hour) name in LEAGUE_TIME_ZONE, in epoch
 * milliseconds. The zone's offset is read at the instant itself, so a day on either side of a
 * daylight-saving change reads its own offset. Throws on a day or a time that is not one.
 */
export function leagueInstantOf(dayKey: string, timeOfDay: string): number {
  const day = CALENDAR_DAY_SHAPE.exec(dayKey);
  const time = TIME_OF_DAY_SHAPE.exec(timeOfDay);
  if (!day || !time)
    throw new RangeError(`Not a calendar day and time of day: '${dayKey}' '${timeOfDay}'.`);
  const wallClock = Date.UTC(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    Number(time[1]),
    Number(time[2]),
  );
  if (new Date(wallClock).toISOString().slice(0, 10) !== dayKey) {
    throw new RangeError(`Not a calendar day: '${dayKey}'.`);
  }
  // The offset at the wall-clock reading taken as UTC is within a day of the right one; read again at
  // the instant that offset gives, so a reading on the other side of a change settles on its own.
  const firstGuess = wallClock - (leagueWallClockAsUtc(wallClock) - wallClock);
  return wallClock - (leagueWallClockAsUtc(firstGuess) - firstGuess);
}
