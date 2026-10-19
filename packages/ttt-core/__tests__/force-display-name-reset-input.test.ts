import { describe, it, expect } from 'vitest';
import { ForceDisplayNameResetInputSchema } from '../src/schemas/users';
import { DISPLAY_NAME_RESET_REASON_INPUT } from '../src/constants/text-fields';

describe('force display-name reset input', () => {
  it('takes the account alone: the admin note is optional', () => {
    expect(ForceDisplayNameResetInputSchema.parse({ userId: 'target-uid' })).toEqual({ userId: 'target-uid' });
  });

  it('keeps a given note trimmed', () => {
    expect(ForceDisplayNameResetInputSchema.parse({ userId: 'target-uid', reason: '  slur in name  ' }).reason).toBe(
      'slur in name',
    );
  });

  it('the note field may be left empty, so a form can offer it as optional', () => {
    expect(DISPLAY_NAME_RESET_REASON_INPUT.min).toBe(0);
  });

  it('takes a note up to its declared length and no longer', () => {
    const max = DISPLAY_NAME_RESET_REASON_INPUT.max;
    expect(ForceDisplayNameResetInputSchema.safeParse({ userId: 'u', reason: 'a'.repeat(max) }).success).toBe(true);
    expect(ForceDisplayNameResetInputSchema.safeParse({ userId: 'u', reason: 'a'.repeat(max + 1) }).success).toBe(false);
  });
});
