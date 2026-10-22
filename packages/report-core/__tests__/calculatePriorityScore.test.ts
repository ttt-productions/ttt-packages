import { describe, it, expect } from 'vitest';
import {
  calculatePriorityScore,
  getHighestScoringReason,
} from '../src/server/calculatePriorityScore.js';
import type { ServerReportCoreConfig } from '../src/server/types.js';

const config: ServerReportCoreConfig['priorityConfig'] = {
  reasonScores: {
    spam: 5,
    harassment: 10,
    violence: 20,
    illegal: 30,
  },
  itemTypeMultipliers: {
    post: 1.0,
    comment: 0.8,
    profile: 1.5,
  },
  additionalReportBonus: 2,
  defaultReasonScore: 3,
  defaultItemTypeMultiplier: 1.0,
};

describe('calculatePriorityScore', () => {
  it('calculates score for a known reason and item type', () => {
    expect(calculatePriorityScore(config, 'harassment', 'post', 1)).toBe(10);
  });

  it('applies item type multiplier', () => {
    expect(calculatePriorityScore(config, 'harassment', 'profile', 1)).toBe(15);
  });

  it('applies lower multiplier for comments', () => {
    expect(calculatePriorityScore(config, 'harassment', 'comment', 1)).toBe(8);
  });

  it('adds report count bonus for multiple reports', () => {
    expect(calculatePriorityScore(config, 'spam', 'post', 3)).toBe(9);
  });

  it('calculates correctly for a single report (no bonus)', () => {
    expect(calculatePriorityScore(config, 'spam', 'post', 1)).toBe(5);
  });

  it('uses defaultReasonScore for unknown reasons', () => {
    expect(calculatePriorityScore(config, 'unknown_reason', 'post', 1)).toBe(3);
  });

  it('uses defaultItemTypeMultiplier for unknown item types', () => {
    expect(calculatePriorityScore(config, 'harassment', 'unknown_type', 1)).toBe(10);
  });

  it('uses both defaults for unknown reason and item type', () => {
    expect(calculatePriorityScore(config, 'unknown', 'unknown', 1)).toBe(3);
  });

  it('calculates highest score correctly (violence)', () => {
    expect(calculatePriorityScore(config, 'violence', 'profile', 2)).toBe(32);
  });

  it('does not apply negative bonus for reportCount < 1', () => {
    expect(calculatePriorityScore(config, 'spam', 'post', 0)).toBe(5);
  });
});

describe('getHighestScoringReason', () => {
  it('returns the single reason when array has one element', () => {
    expect(getHighestScoringReason(config, ['spam'])).toBe('spam');
  });

  it('returns the highest scoring reason from multiple', () => {
    expect(getHighestScoringReason(config, ['spam', 'harassment', 'violence'])).toBe('violence');
  });

  it('returns the highest when first is highest', () => {
    expect(getHighestScoringReason(config, ['illegal', 'spam'])).toBe('illegal');
  });

  it('returns the highest when last is highest', () => {
    expect(getHighestScoringReason(config, ['spam', 'illegal'])).toBe('illegal');
  });

  it('returns empty string for empty array', () => {
    expect(getHighestScoringReason(config, [])).toBe('');
  });

  it('falls back to defaultReasonScore for unknown reasons', () => {
    expect(getHighestScoringReason(config, ['unknown1', 'spam'])).toBe('spam');
  });

  it('returns first unknown reason when all are unknown (tied at default)', () => {
    expect(getHighestScoringReason(config, ['unknown1', 'unknown2'])).toBe('unknown1');
  });

  it('handles all equal scores (returns first)', () => {
    expect(getHighestScoringReason(config, ['spam', 'spam'])).toBe('spam');
  });
});
