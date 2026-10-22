import { describe, it, expect } from 'vitest';
import {
  TakeItDownInvalidReasonCodeSchema,
  NciiRemovalCompletionOutcomeSchema,
  NciiTargetOutcomeSchema,
} from '../src/doc-schemas/safety/foundation.js';
import * as safetyFoundation from '../src/doc-schemas/safety/foundation.js';
import { DecideTakeItDownValidityInputSchema } from '../src/schemas/ncii.js';
import { TAKE_IT_DOWN_VALIDITY_CONFIRMATION } from '../src/constants/safety-confirmation-phrases.js';

describe('Take It Down invalid-ruling reasons', () => {
  it('offers no reason that rests on a lawyer approval', () => {
    expect(TakeItDownInvalidReasonCodeSchema.options).not.toContain('otherCounselApproved');
  });

  it('is the one list the validity callable input accepts', () => {
    const input = {
      requestId: 'request-1',
      result: 'invalid',
      rationaleText: 'The request names no content on TTT.',
      confirmation: TAKE_IT_DOWN_VALIDITY_CONFIRMATION,
    };
    for (const reasonCode of TakeItDownInvalidReasonCodeSchema.options) {
      expect(DecideTakeItDownValidityInputSchema.safeParse({ ...input, reasonCode }).success).toBe(
        true,
      );
    }
    expect(
      DecideTakeItDownValidityInputSchema.safeParse({
        ...input,
        reasonCode: 'otherCounselApproved',
      }).success,
    ).toBe(false);
  });
});

describe('NCII removal outcomes', () => {
  it('completes only when every target is verified gone; anything less is unableToComplete', () => {
    expect(NciiRemovalCompletionOutcomeSchema.options).toEqual(['completed', 'unableToComplete']);
  });

  it('has no approved-exception outcome for a target', () => {
    expect(NciiTargetOutcomeSchema.options).not.toContain('terminalException');
    expect('NciiTerminalExceptionSchema' in safetyFoundation).toBe(false);
  });
});
