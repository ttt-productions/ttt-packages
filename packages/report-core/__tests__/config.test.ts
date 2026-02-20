import { describe, it, expect } from 'vitest';
import { DEFAULT_PRIORITY_THRESHOLDS, ADMIN_TASK_STATUS } from '../src/config';

describe('DEFAULT_PRIORITY_THRESHOLDS', () => {
  it('is sorted by minScore descending', () => {
    const scores = DEFAULT_PRIORITY_THRESHOLDS.map((t) => t.minScore);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i + 1]);
    }
  });

  it('has required fields on all thresholds', () => {
    for (const t of DEFAULT_PRIORITY_THRESHOLDS) {
      expect(typeof t.minScore).toBe('number');
      expect(typeof t.label).toBe('string');
      expect(typeof t.className).toBe('string');
    }
  });

  it('has a CRITICAL threshold', () => {
    const critical = DEFAULT_PRIORITY_THRESHOLDS.find((t) => t.label === 'CRITICAL');
    expect(critical).toBeDefined();
    expect(critical!.minScore).toBeGreaterThan(0);
  });

  it('has a LOW threshold with minScore 0', () => {
    const low = DEFAULT_PRIORITY_THRESHOLDS.find((t) => t.label === 'LOW');
    expect(low).toBeDefined();
    expect(low!.minScore).toBe(0);
  });

  it('has at least 3 thresholds', () => {
    expect(DEFAULT_PRIORITY_THRESHOLDS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ADMIN_TASK_STATUS', () => {
  it('has PENDING = "pending"', () => {
    expect(ADMIN_TASK_STATUS.PENDING).toBe('pending');
  });

  it('has CHECKED_OUT = "checkedOut"', () => {
    expect(ADMIN_TASK_STATUS.CHECKED_OUT).toBe('checkedOut');
  });

  it('has WORK_LATER = "workLater"', () => {
    expect(ADMIN_TASK_STATUS.WORK_LATER).toBe('workLater');
  });

  it('has COMPLETED = "completed"', () => {
    expect(ADMIN_TASK_STATUS.COMPLETED).toBe('completed');
  });
});
