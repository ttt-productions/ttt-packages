// What a team leader or an admin may do to one member: the captain is never moved or removed; only the
// captain and an admin promote and demote, and never make a ghost a co-captain; a co-captain removes
// plain players only. The team's management callables refuse what this leaves out.

import { describe, expect, it } from 'vitest';
import { TEAM_CAPTAIN_ROLE, TEAM_CO_CAPTAIN_ROLE, TEAM_PLAYER_ROLE } from '../src/types/unions.js';
import { TEAM_MEMBER_ADMIN_ACTOR, teamMemberActions } from '../src/utils/team-member-actions.js';

const player = { role: TEAM_PLAYER_ROLE, isGhost: false };
const ghost = { role: TEAM_PLAYER_ROLE, isGhost: true };
const coCaptain = { role: TEAM_CO_CAPTAIN_ROLE, isGhost: false };
const ghostCoCaptain = { role: TEAM_CO_CAPTAIN_ROLE, isGhost: true };
const captain = { role: TEAM_CAPTAIN_ROLE, isGhost: false };

describe('the captain', () => {
  it('is offered for no change by anyone: an admin changes the team captain first', () => {
    for (const actor of [TEAM_MEMBER_ADMIN_ACTOR, TEAM_CAPTAIN_ROLE, TEAM_CO_CAPTAIN_ROLE] as const) {
      expect(teamMemberActions(actor, captain)).toEqual({ promote: false, demote: false, remove: false });
      expect(teamMemberActions(actor, { ...captain, isGhost: true })).toEqual({ promote: false, demote: false, remove: false });
    }
  });
});

describe('the captain and an admin', () => {
  for (const actor of [TEAM_CAPTAIN_ROLE, TEAM_MEMBER_ADMIN_ACTOR] as const) {
    it(`as ${actor}: promote a player, and remove them`, () => {
      expect(teamMemberActions(actor, player)).toEqual({ promote: true, demote: false, remove: true });
    });

    it(`as ${actor}: demote a co-captain, and remove them`, () => {
      expect(teamMemberActions(actor, coCaptain)).toEqual({ promote: false, demote: true, remove: true });
    });

    it(`as ${actor}: never make a ghost a co-captain, but remove it`, () => {
      expect(teamMemberActions(actor, ghost)).toEqual({ promote: false, demote: false, remove: true });
    });

    it(`as ${actor}: demote and remove a ghost co-captain copied data holds`, () => {
      expect(teamMemberActions(actor, ghostCoCaptain)).toEqual({ promote: false, demote: true, remove: true });
    });
  }
});

describe('a co-captain', () => {
  it('removes a plain player and a ghost player, and promotes no one', () => {
    expect(teamMemberActions(TEAM_CO_CAPTAIN_ROLE, player)).toEqual({ promote: false, demote: false, remove: true });
    expect(teamMemberActions(TEAM_CO_CAPTAIN_ROLE, ghost)).toEqual({ promote: false, demote: false, remove: true });
  });

  it('neither demotes nor removes another co-captain, a ghost co-captain included', () => {
    expect(teamMemberActions(TEAM_CO_CAPTAIN_ROLE, coCaptain)).toEqual({ promote: false, demote: false, remove: false });
    expect(teamMemberActions(TEAM_CO_CAPTAIN_ROLE, ghostCoCaptain)).toEqual({ promote: false, demote: false, remove: false });
  });
});
