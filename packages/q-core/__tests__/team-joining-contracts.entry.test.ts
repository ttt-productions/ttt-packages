import { describe, it, expect } from 'vitest';
import * as schemas from '../src/schemas';

describe('the invitation wire contracts', () => {
  it('name an answer by the callable, never by a payload field — accept and decline are separate entries', () => {
    expect(Object.keys(schemas)).not.toContain('RespondToTeamInvitationInputSchema');
  });
});
