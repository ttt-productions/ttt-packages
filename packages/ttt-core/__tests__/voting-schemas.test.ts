import { describe, it, expect } from 'vitest';
import { VoteForAuditionEntryInputSchema } from '../src/schemas/voting';

describe('VoteForAuditionEntryInputSchema', () => {
  it('accepts the audition and the entry being voted for', () => {
    expect(
      VoteForAuditionEntryInputSchema.parse({ auditionId: 'a1', newVote: { auditionEntryId: 'e1' } }),
    ).toEqual({ auditionId: 'a1', newVote: { auditionEntryId: 'e1' } });
  });

  it('refuses a client claim about the current vote — the server reads it itself', () => {
    expect(() =>
      VoteForAuditionEntryInputSchema.parse({
        auditionId: 'a1',
        newVote: { auditionEntryId: 'e1' },
        currentVoteId: 'e0',
      }),
    ).toThrow();
  });
});
