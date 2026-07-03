import { describe, it, expect } from 'vitest';
import {
  TASK_PRIORITY,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_SCORE,
  TASK_PRIORITY_LEVEL_TO_SCORE,
  SHORT_LINK_CHARS,
  SHORT_LINK_LENGTH,
  SHORT_LINK_MAX_ATTEMPTS,
  FIRESTORE_BATCH_LIMIT,
  MAX_WORK_PROJECT_STAKE_SHARES,
  MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH,
} from '../src/constants/business';

describe('TASK_PRIORITY', () => {
  it('CRITICAL is 4', () => {
    expect(TASK_PRIORITY.CRITICAL).toBe(4);
  });

  it('HIGH is 3', () => {
    expect(TASK_PRIORITY.HIGH).toBe(3);
  });

  it('NORMAL is 2', () => {
    expect(TASK_PRIORITY.NORMAL).toBe(2);
  });

  it('LOW is 1', () => {
    expect(TASK_PRIORITY.LOW).toBe(1);
  });

  it('all values are between 1 and 4', () => {
    for (const value of Object.values(TASK_PRIORITY)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(4);
    }
  });
});

describe('TASK_PRIORITY_LABELS', () => {
  it('maps 4 (CRITICAL) to "CRITICAL"', () => {
    expect(TASK_PRIORITY_LABELS[TASK_PRIORITY.CRITICAL]).toBe('CRITICAL');
  });

  it('maps 3 (HIGH) to "HIGH"', () => {
    expect(TASK_PRIORITY_LABELS[TASK_PRIORITY.HIGH]).toBe('HIGH');
  });

  it('maps 2 (NORMAL) to "NORMAL"', () => {
    expect(TASK_PRIORITY_LABELS[TASK_PRIORITY.NORMAL]).toBe('NORMAL');
  });

  it('maps 1 (LOW) to "LOW"', () => {
    expect(TASK_PRIORITY_LABELS[TASK_PRIORITY.LOW]).toBe('LOW');
  });
});

describe('TASK_PRIORITY_SCORE (canonical numeric scale)', () => {
  it('has the DJ-decided values', () => {
    expect(TASK_PRIORITY_SCORE.LOW).toBe(50);
    expect(TASK_PRIORITY_SCORE.NORMAL).toBe(200);
    expect(TASK_PRIORITY_SCORE.HIGH).toBe(800);
    expect(TASK_PRIORITY_SCORE.CRITICAL).toBe(1000);
    expect(TASK_PRIORITY_SCORE.MONEY_ANOMALY).toBe(1100);
  });

  it('orders LOW < NORMAL < HIGH < CRITICAL < MONEY_ANOMALY', () => {
    expect(TASK_PRIORITY_SCORE.LOW).toBeLessThan(TASK_PRIORITY_SCORE.NORMAL);
    expect(TASK_PRIORITY_SCORE.NORMAL).toBeLessThan(TASK_PRIORITY_SCORE.HIGH);
    expect(TASK_PRIORITY_SCORE.HIGH).toBeLessThan(TASK_PRIORITY_SCORE.CRITICAL);
    expect(TASK_PRIORITY_SCORE.CRITICAL).toBeLessThan(TASK_PRIORITY_SCORE.MONEY_ANOMALY);
  });

  it('maps every TASK_PRIORITY level to its numeric score', () => {
    expect(TASK_PRIORITY_LEVEL_TO_SCORE[TASK_PRIORITY.LOW]).toBe(TASK_PRIORITY_SCORE.LOW);
    expect(TASK_PRIORITY_LEVEL_TO_SCORE[TASK_PRIORITY.NORMAL]).toBe(TASK_PRIORITY_SCORE.NORMAL);
    expect(TASK_PRIORITY_LEVEL_TO_SCORE[TASK_PRIORITY.HIGH]).toBe(TASK_PRIORITY_SCORE.HIGH);
    expect(TASK_PRIORITY_LEVEL_TO_SCORE[TASK_PRIORITY.CRITICAL]).toBe(TASK_PRIORITY_SCORE.CRITICAL);
  });
});

describe('SHORT_LINK_CHARS', () => {
  it('excludes ambiguous character "0" (zero)', () => {
    expect(SHORT_LINK_CHARS).not.toContain('0');
  });

  it('excludes ambiguous character "O" (uppercase oh)', () => {
    expect(SHORT_LINK_CHARS).not.toContain('O');
  });

  it('excludes ambiguous character "l" (lowercase L)', () => {
    expect(SHORT_LINK_CHARS).not.toContain('l');
  });

  it('excludes ambiguous character "1" (one)', () => {
    expect(SHORT_LINK_CHARS).not.toContain('1');
  });

  it('excludes ambiguous character "I" (uppercase i)', () => {
    expect(SHORT_LINK_CHARS).not.toContain('I');
  });

  it('is a non-empty string', () => {
    expect(typeof SHORT_LINK_CHARS).toBe('string');
    expect(SHORT_LINK_CHARS.length).toBeGreaterThan(0);
  });
});

describe('SHORT_LINK_LENGTH', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(SHORT_LINK_LENGTH)).toBe(true);
    expect(SHORT_LINK_LENGTH).toBeGreaterThan(0);
  });

  it('is 6', () => {
    expect(SHORT_LINK_LENGTH).toBe(6);
  });
});

describe('SHORT_LINK_MAX_ATTEMPTS', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(SHORT_LINK_MAX_ATTEMPTS)).toBe(true);
    expect(SHORT_LINK_MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it('is 5', () => {
    expect(SHORT_LINK_MAX_ATTEMPTS).toBe(5);
  });
});

describe('FIRESTORE_BATCH_LIMIT', () => {
  it('is 500', () => {
    expect(FIRESTORE_BATCH_LIMIT).toBe(500);
  });
});

describe('MAX_WORK_PROJECT_STAKE_SHARES', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(MAX_WORK_PROJECT_STAKE_SHARES)).toBe(true);
    expect(MAX_WORK_PROJECT_STAKE_SHARES).toBeGreaterThan(0);
  });
});

describe('MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH)).toBe(true);
    expect(MAX_SQUARE_STREETZ_DESCRIPTION_LENGTH).toBeGreaterThan(0);
  });
});

