// Canonical user-facing reason picklist + label helper (ARCH-102): the ONE home for the guided
// resolution flow's user-facing reason options, moved out of the app so every client renders the
// same codes + labels.

import { describe, it, expect } from 'vitest';
import {
  USER_FACING_REASON_OPTIONS,
  userFacingReasonLabel,
} from '../src/constants/admin-labels';

describe('USER_FACING_REASON_OPTIONS', () => {
  it('carries the full canonical code set', () => {
    expect(USER_FACING_REASON_OPTIONS.map((o) => o.code)).toEqual([
      'harassment',
      'hate',
      'adult-content',
      'violence',
      'spam',
      'impersonation',
      'ip',
      'nonconsensual',
      'safety',
      'other',
    ]);
  });

  it('every option has a non-empty label and description', () => {
    for (const option of USER_FACING_REASON_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });
});

describe('userFacingReasonLabel', () => {
  it('returns the label for a known code', () => {
    expect(userFacingReasonLabel('harassment')).toBe('Harassment or bullying');
    expect(userFacingReasonLabel('nonconsensual')).toBe('Nonconsensual intimate imagery');
    expect(userFacingReasonLabel('other')).toBe('Other (explain)');
  });

  it('returns undefined for an unknown or absent code', () => {
    expect(userFacingReasonLabel('does-not-exist')).toBeUndefined();
    expect(userFacingReasonLabel(undefined)).toBeUndefined();
  });
});
