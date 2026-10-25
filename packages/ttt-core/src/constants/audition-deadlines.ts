import { z } from 'zod';
import type { Audition } from '../doc-schemas/commissions.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const AUDITION_MIN_ENTRY_WINDOW_MS = 7 * DAY_MS;

export const AUDITION_MIN_VOTING_AFTER_ENTRIES_MS = 24 * HOUR_MS;

export const AUDITION_DEFAULT_ENTRY_WINDOW_WEEKS = 3;

export const AUDITION_DEFAULT_CLOSE_AFTER_ENTRIES_DAYS = 1;

export const AUDITION_END_OF_DAY = { hours: 23, minutes: 59 } as const;

export const AuditionDeadlineSchema = z.number().int().positive();

export interface AuditionDeadlines {
  entriesCloseAt: number;
  auditionCloseAt: number;
}

export type AuditionDeadlineProblem = 'entriesCloseTooSoon' | 'auditionCloseTooSoon';

export const AUDITION_DEADLINE_PROBLEM_MESSAGES: Record<AuditionDeadlineProblem, string> = {
  entriesCloseTooSoon: `Entries must stay open for at least ${AUDITION_MIN_ENTRY_WINDOW_MS / DAY_MS} days after posting.`,
  auditionCloseTooSoon: `The audition must close at least ${AUDITION_MIN_VOTING_AFTER_ENTRIES_MS / HOUR_MS} hours after entries close.`,
};

export function refineAuditionDeadlineOrder(value: AuditionDeadlines, ctx: z.RefinementCtx): void {
  if (value.auditionCloseAt < earliestAuditionCloseAt(value.entriesCloseAt)) {
    ctx.addIssue({
      code: 'custom',
      path: ['auditionCloseAt'],
      message: AUDITION_DEADLINE_PROBLEM_MESSAGES.auditionCloseTooSoon,
    });
  }
}

export function earliestAuditionEntriesCloseAt(postedAt: number): number {
  return postedAt + AUDITION_MIN_ENTRY_WINDOW_MS;
}

export function earliestAuditionCloseAt(entriesCloseAt: number): number {
  return entriesCloseAt + AUDITION_MIN_VOTING_AFTER_ENTRIES_MS;
}

export function auditionDeadlineProblem(
  deadlines: AuditionDeadlines,
  postedAt: number,
): AuditionDeadlineProblem | null {
  if (deadlines.entriesCloseAt < earliestAuditionEntriesCloseAt(postedAt))
    return 'entriesCloseTooSoon';
  if (deadlines.auditionCloseAt < earliestAuditionCloseAt(deadlines.entriesCloseAt))
    return 'auditionCloseTooSoon';
  return null;
}

export function areAuditionEntriesOpen(
  audition: Pick<Audition, 'status' | 'entriesCloseAt'>,
  submittedAt: number,
): boolean {
  return audition.status === 'open' && submittedAt < audition.entriesCloseAt;
}

export function isAuditionVotingOpen(
  audition: Pick<Audition, 'status' | 'auditionCloseAt'>,
  now: number,
): boolean {
  return audition.status === 'open' && now < audition.auditionCloseAt;
}

function endOfLocalDay(year: number, monthIndex: number, day: number): Date {
  return new Date(
    year,
    monthIndex,
    day,
    AUDITION_END_OF_DAY.hours,
    AUDITION_END_OF_DAY.minutes,
    0,
    0,
  );
}

export function defaultAuditionEntriesCloseAt(today: Date): Date {
  return endOfLocalDay(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + AUDITION_DEFAULT_ENTRY_WINDOW_WEEKS * 7,
  );
}

// A clock change can shorten a day below the 24-hour minimum, so the loop steps to the next day.
export function defaultAuditionCloseAt(entriesCloseAt: Date): Date {
  let offset = AUDITION_DEFAULT_CLOSE_AFTER_ENTRIES_DAYS;
  let candidate = endOfLocalDay(
    entriesCloseAt.getFullYear(),
    entriesCloseAt.getMonth(),
    entriesCloseAt.getDate() + offset,
  );
  while (candidate.getTime() < earliestAuditionCloseAt(entriesCloseAt.getTime())) {
    offset += 1;
    candidate = endOfLocalDay(
      entriesCloseAt.getFullYear(),
      entriesCloseAt.getMonth(),
      entriesCloseAt.getDate() + offset,
    );
  }
  return candidate;
}
