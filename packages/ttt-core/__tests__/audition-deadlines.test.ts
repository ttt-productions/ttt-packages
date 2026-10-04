import { describe, it, expect } from 'vitest';
import {
  AUDITION_DEADLINE_PROBLEM_MESSAGES,
  AUDITION_MIN_ENTRY_WINDOW_MS,
  AUDITION_MIN_VOTING_AFTER_ENTRIES_MS,
  auditionDeadlineProblem,
  areAuditionEntriesOpen,
  isAuditionVotingOpen,
  defaultAuditionEntriesCloseAt,
  defaultAuditionCloseAt,
  earliestAuditionEntriesCloseAt,
  earliestAuditionCloseAt,
} from '../src/index';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const posted = Date.UTC(2030, 2, 1, 12, 0, 0);

describe('audition deadline minimums', () => {
  it('entries close at least 7 days after posting, and the audition at least 24 hours after that', () => {
    expect(AUDITION_MIN_ENTRY_WINDOW_MS).toBe(7 * DAY);
    expect(AUDITION_MIN_VOTING_AFTER_ENTRIES_MS).toBe(24 * HOUR);
    expect(earliestAuditionEntriesCloseAt(posted)).toBe(posted + 7 * DAY);
    expect(earliestAuditionCloseAt(posted + 7 * DAY)).toBe(posted + 8 * DAY);
  });

  it('accepts deadlines exactly on both minimums', () => {
    expect(
      auditionDeadlineProblem({ entriesCloseAt: posted + 7 * DAY, auditionCloseAt: posted + 8 * DAY }, posted),
    ).toBeNull();
  });

  it('refuses entries that close sooner than 7 days after posting', () => {
    expect(
      auditionDeadlineProblem({ entriesCloseAt: posted + 7 * DAY - 1, auditionCloseAt: posted + 30 * DAY }, posted),
    ).toBe('entriesCloseTooSoon');
  });

  it('refuses an audition that closes sooner than 24 hours after entries close', () => {
    expect(
      auditionDeadlineProblem({ entriesCloseAt: posted + 10 * DAY, auditionCloseAt: posted + 11 * DAY - 1 }, posted),
    ).toBe('auditionCloseTooSoon');
  });
});

describe('entries are judged by submit time, votes by now', () => {
  const audition = { status: 'open' as const, entriesCloseAt: 1_000, auditionCloseAt: 1_000 + DAY };

  it('counts an entry submitted before entries close, whenever it finishes processing', () => {
    expect(areAuditionEntriesOpen(audition, 999)).toBe(true);
  });

  it('refuses an entry submitted at or after the entries close', () => {
    expect(areAuditionEntriesOpen(audition, 1_000)).toBe(false);
    expect(areAuditionEntriesOpen(audition, 1_001)).toBe(false);
  });

  it('keeps voting open after entries close, until the audition closes', () => {
    expect(isAuditionVotingOpen(audition, 1_500)).toBe(true);
    expect(isAuditionVotingOpen(audition, 1_000 + DAY)).toBe(false);
  });

  it('opens neither for an audition that is not open', () => {
    for (const status of ['closed', 'pendingReview'] as const) {
      const notOpen = { ...audition, status };
      expect(areAuditionEntriesOpen(notOpen, 0)).toBe(false);
      expect(isAuditionVotingOpen(notOpen, 0)).toBe(false);
    }
  });
});

describe('picker defaults', () => {
  const parts = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()];

  it('opens the entries-close picker on the end of the day three weeks out', () => {
    expect(parts(defaultAuditionEntriesCloseAt(new Date(2030, 2, 1, 9, 30)))).toEqual([2030, 2, 22, 23, 59]);
  });

  it('opens the audition-close picker on the end of the day after entries close', () => {
    expect(parts(defaultAuditionCloseAt(new Date(2030, 2, 22, 23, 59)))).toEqual([2030, 2, 23, 23, 59]);
  });

  it('always opens on deadlines that meet both minimums', () => {
    const today = new Date(2030, 2, 1, 9, 30);
    const entries = defaultAuditionEntriesCloseAt(today);
    const close = defaultAuditionCloseAt(entries);
    expect(
      auditionDeadlineProblem({ entriesCloseAt: entries.getTime(), auditionCloseAt: close.getTime() }, today.getTime()),
    ).toBeNull();
  });
});

describe('the stored audition holds its deadlines to the wire constraints', () => {
  it('refuses a non-positive or fractional deadline on the audition doc', async () => {
    const { AuditionSchema } = await import('../src/doc-schemas/commissions');
    const field = AuditionSchema.shape.entriesCloseAt;
    expect(field.safeParse(1_700_000_000_000).success).toBe(true);
    for (const bad of [0, -1, 1.5]) {
      expect(field.safeParse(bad).success).toBe(false);
      expect(AuditionSchema.shape.auditionCloseAt.safeParse(bad).success).toBe(false);
    }
  });
});

describe('the deadline refusal copy', () => {
  it('states each broken minimum gap in the approved words', () => {
    expect(AUDITION_DEADLINE_PROBLEM_MESSAGES).toEqual({
      entriesCloseTooSoon: 'Entries must stay open for at least 7 days after posting.',
      auditionCloseTooSoon: 'The audition must close at least 24 hours after entries close.',
    });
  });

  it('has the words for every problem the rule can report', () => {
    const tooSoonEntries = auditionDeadlineProblem({ entriesCloseAt: posted + DAY, auditionCloseAt: posted + 30 * DAY }, posted);
    const tooSoonClose = auditionDeadlineProblem({ entriesCloseAt: posted + 8 * DAY, auditionCloseAt: posted + 8 * DAY + HOUR }, posted);
    expect(AUDITION_DEADLINE_PROBLEM_MESSAGES[tooSoonEntries!]).toContain('7 days');
    expect(AUDITION_DEADLINE_PROBLEM_MESSAGES[tooSoonClose!]).toContain('24 hours');
  });
});
