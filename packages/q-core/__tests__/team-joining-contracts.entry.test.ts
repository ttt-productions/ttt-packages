import { describe, it, expect } from 'vitest';
import { TeamInvitationTargetInputSchema } from '../src/schemas';
import * as schemas from '../src/schemas';

describe('the invitation wire contracts', () => {
  it('name an answer by the callable, never by a payload field — accept and decline are separate entries', () => {
    expect(TeamInvitationTargetInputSchema.safeParse({ teamInvitationId: 'inv-1', response: 'approved' }).success).toBe(false);
    expect(Object.keys(schemas)).not.toContain('RespondToTeamInvitationInputSchema');
  });
});
