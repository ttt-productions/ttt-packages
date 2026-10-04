// An audition's two deadlines, both picked by its poster:
//  - entries close (`entriesCloseAt`) — an entry counts by the moment it was SUBMITTED, so one
//    uploaded before the cut-off still publishes if its processing finishes after it;
//  - the audition closes (`auditionCloseAt`) — voting runs until then.
// Entries and voting both open when the audition is posted. The server enforces both cut-offs
// exactly through the predicates below; the daily job only tidies `status`. The UI offers an
// action from the same predicates (FRONTEND-110).

import { z } from 'zod';
import type { Audition } from '../doc-schemas/commissions.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Entries close at least this long after the audition is posted. */
export const AUDITION_MIN_ENTRY_WINDOW_MS = 7 * DAY_MS;

/** The audition closes at least this long after entries close (voting continues meanwhile). */
export const AUDITION_MIN_VOTING_AFTER_ENTRIES_MS = 24 * HOUR_MS;

/** The entries-close picker opens this many weeks after today, at the end of that day. */
export const AUDITION_DEFAULT_ENTRY_WINDOW_WEEKS = 3;

/** The audition-close picker opens this many days after entries close, at the end of that day. */
export const AUDITION_DEFAULT_CLOSE_AFTER_ENTRIES_DAYS = 1;

/** End of a day, as the date-and-time picker expresses it: 11:59 PM local time. */
export const AUDITION_END_OF_DAY = { hours: 23, minutes: 59 } as const;

/** One deadline: epoch milliseconds. */
export const AuditionDeadlineSchema = z.number().int().positive();

export interface AuditionDeadlines {
  entriesCloseAt: number;
  auditionCloseAt: number;
}

/** Which minimum gap a pair of deadlines breaks. */
export type AuditionDeadlineProblem = 'entriesCloseTooSoon' | 'auditionCloseTooSoon';

/** The refusal each broken minimum gap answers with — the server's refusal and the form's alike. */
export const AUDITION_DEADLINE_PROBLEM_MESSAGES: Record<AuditionDeadlineProblem, string> = {
  entriesCloseTooSoon: `Entries must stay open for at least ${AUDITION_MIN_ENTRY_WINDOW_MS / DAY_MS} days after posting.`,
  auditionCloseTooSoon: `The audition must close at least ${AUDITION_MIN_VOTING_AFTER_ENTRIES_MS / HOUR_MS} hours after entries close.`,
};

/**
 * The deadline-pair rule every wire schema carrying both deadlines refines with: the audition
 * closes at least `AUDITION_MIN_VOTING_AFTER_ENTRIES_MS` after entries close. (The gap from the
 * posting time depends on WHEN the audition is posted, so it is checked by
 * `auditionDeadlineProblem` at the moment of posting, never inside a schema a later step
 * re-parses.)
 */
export function refineAuditionDeadlineOrder(value: AuditionDeadlines, ctx: z.RefinementCtx): void {
  if (value.auditionCloseAt < value.entriesCloseAt + AUDITION_MIN_VOTING_AFTER_ENTRIES_MS) {
    ctx.addIssue({ code: 'custom', path: ['auditionCloseAt'] });
  }
}

/** The earliest allowed entries-close time for an audition posted at `postedAt`. */
export function earliestAuditionEntriesCloseAt(postedAt: number): number {
  return postedAt + AUDITION_MIN_ENTRY_WINDOW_MS;
}

/** The earliest allowed audition-close time for entries closing at `entriesCloseAt`. */
export function earliestAuditionCloseAt(entriesCloseAt: number): number {
  return entriesCloseAt + AUDITION_MIN_VOTING_AFTER_ENTRIES_MS;
}

/**
 * Which minimum gap `deadlines` break for an audition posted at `postedAt` — the submit time
 * of its upload — or `null` when both hold.
 */
export function auditionDeadlineProblem(
  deadlines: AuditionDeadlines,
  postedAt: number,
): AuditionDeadlineProblem | null {
  if (deadlines.entriesCloseAt < earliestAuditionEntriesCloseAt(postedAt)) return 'entriesCloseTooSoon';
  if (deadlines.auditionCloseAt < earliestAuditionCloseAt(deadlines.entriesCloseAt)) return 'auditionCloseTooSoon';
  return null;
}

/**
 * Whether an entry submitted at `submittedAt` is in time: the audition is open and the entry
 * was submitted before entries closed. The server passes the upload's submit time (so a
 * slow-processing entry submitted in time still counts); the UI passes now.
 */
export function areAuditionEntriesOpen(
  audition: Pick<Audition, 'status' | 'entriesCloseAt'>,
  submittedAt: number,
): boolean {
  return audition.status === 'open' && submittedAt < audition.entriesCloseAt;
}

/** Whether a vote cast at `now` is in time: the audition is open and has not closed. */
export function isAuditionVotingOpen(
  audition: Pick<Audition, 'status' | 'auditionCloseAt'>,
  now: number,
): boolean {
  return audition.status === 'open' && now < audition.auditionCloseAt;
}

function endOfLocalDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, AUDITION_END_OF_DAY.hours, AUDITION_END_OF_DAY.minutes, 0, 0);
}

/** Where the entries-close picker opens: the end of the day three weeks from `today`. */
export function defaultAuditionEntriesCloseAt(today: Date): Date {
  return endOfLocalDay(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + AUDITION_DEFAULT_ENTRY_WINDOW_WEEKS * 7,
  );
}

/**
 * Where the audition-close picker opens: the end of the day after entries close — or of the
 * next day that keeps the 24-hour minimum, should a clock change shorten that day.
 */
export function defaultAuditionCloseAt(entriesCloseAt: Date): Date {
  let offset = AUDITION_DEFAULT_CLOSE_AFTER_ENTRIES_DAYS;
  let candidate = endOfLocalDay(entriesCloseAt.getFullYear(), entriesCloseAt.getMonth(), entriesCloseAt.getDate() + offset);
  while (candidate.getTime() < earliestAuditionCloseAt(entriesCloseAt.getTime())) {
    offset += 1;
    candidate = endOfLocalDay(entriesCloseAt.getFullYear(), entriesCloseAt.getMonth(), entriesCloseAt.getDate() + offset);
  }
  return candidate;
}
