// The contracts the joining doors are built on: the invitation, join-request, and free-agent wire
// schemas, the statuses each document moves through, the events a client names after each door, the
// audit types each door records under, and the team field that makes a new invitation or request
// contend with every other door on the team.

import { describe, it, expect } from 'vitest';
import {
  MAX_TEAM_INVITATION_MESSAGE_LENGTH,
  MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
} from '../src/constants/business';
import { LeagueTeamSchema, TeamInvitationSchema, TeamJoinRequestSchema } from '../src/doc-schemas';
import { DomainEventSchema } from '../src/domain-events';
import {
  AcceptTeamInvitationResultSchema,
  AcceptTeamJoinRequestResultSchema,
  AdminAssignLeagueFreeAgentInputSchema,
  AdminAssignLeagueFreeAgentResultSchema,
  CreateLeagueFreeAgentResultSchema,
  CreateTeamInvitationInputSchema,
  CreateTeamJoinRequestInputSchema,
  DeleteLeagueFreeAgentResultSchema,
  LeagueFreeAgentInputSchema,
  TeamInvitationResultSchema,
  TeamInvitationTargetInputSchema,
  TeamJoinRequestResultSchema,
  TeamJoinRequestTargetInputSchema,
} from '../src/schemas';
import * as schemas from '../src/schemas';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit';
import {
  APPROVED_TEAM_INVITATION_STATUS,
  APPROVED_TEAM_JOIN_REQUEST_STATUS,
  CANCELLED_TEAM_INVITATION_STATUS,
  CANCELLED_TEAM_JOIN_REQUEST_STATUS,
  PENDING_TEAM_INVITATION_STATUS,
  PENDING_TEAM_JOIN_REQUEST_STATUS,
  REJECTED_TEAM_INVITATION_STATUS,
  REJECTED_TEAM_JOIN_REQUEST_STATUS,
  TEAM_INVITATION_STATUS_KEYS,
  TEAM_JOIN_REQUEST_STATUS_KEYS,
} from '../src/types/unions';

const NOW = 1_712_345_678_901;

describe('the statuses an invitation and a join request move through', () => {
  it('an invitation is pending until accepted, declined, or withdrawn — withdrawal kept as a status, never a deletion', () => {
    expect([...TEAM_INVITATION_STATUS_KEYS].sort()).toEqual(
      [
        PENDING_TEAM_INVITATION_STATUS,
        APPROVED_TEAM_INVITATION_STATUS,
        REJECTED_TEAM_INVITATION_STATUS,
        CANCELLED_TEAM_INVITATION_STATUS,
      ].sort(),
    );
  });

  it('a join request is pending until accepted, rejected, or withdrawn', () => {
    expect([...TEAM_JOIN_REQUEST_STATUS_KEYS].sort()).toEqual(
      [
        PENDING_TEAM_JOIN_REQUEST_STATUS,
        APPROVED_TEAM_JOIN_REQUEST_STATUS,
        REJECTED_TEAM_JOIN_REQUEST_STATUS,
        CANCELLED_TEAM_JOIN_REQUEST_STATUS,
      ].sort(),
    );
  });

  it('the stored documents accept every declared status and nothing else', () => {
    const invitation = {
      leagueId: 'L1',
      teamId: 'T1',
      invitedUserId: 'u1',
      invitedByUserId: 'c1',
      message: '',
      status: 'pending',
      createdAt: NOW,
    };
    for (const status of TEAM_INVITATION_STATUS_KEYS) {
      expect(TeamInvitationSchema.safeParse({ ...invitation, status }).success).toBe(true);
    }
    expect(TeamInvitationSchema.safeParse({ ...invitation, status: 'expired' }).success).toBe(false);

    const request = { leagueId: 'L1', teamId: 'T1', userId: 'u1', message: 'x'.repeat(10), status: 'pending', createdAt: NOW };
    for (const status of TEAM_JOIN_REQUEST_STATUS_KEYS) {
      expect(TeamJoinRequestSchema.safeParse({ ...request, status }).success).toBe(true);
    }
  });
});

describe('the invitation wire contracts', () => {
  const valid = { teamId: 'T1', invitedUserId: 'u1', message: 'Come play with us.' };

  it('take the team, the invitee, and an optional note bounded by MAX_TEAM_INVITATION_MESSAGE_LENGTH, trimmed', () => {
    expect(CreateTeamInvitationInputSchema.parse({ ...valid, message: '  hi  ' }).message).toBe('hi');
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, message: '' }).success).toBe(true);
    expect(
      CreateTeamInvitationInputSchema.safeParse({ ...valid, message: 'x'.repeat(MAX_TEAM_INVITATION_MESSAGE_LENGTH) }).success,
    ).toBe(true);
    expect(
      CreateTeamInvitationInputSchema.safeParse({ ...valid, message: 'x'.repeat(MAX_TEAM_INVITATION_MESSAGE_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('never take the inviter or the league from the payload, and never a path segment holding a slash', () => {
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, invitedByUserId: 'someone' }).success).toBe(false);
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, leagueId: 'L9' }).success).toBe(false);
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, teamId: 'T1/evil' }).success).toBe(false);
    expect(TeamInvitationTargetInputSchema.safeParse({ teamInvitationId: 'a/b' }).success).toBe(false);
  });

  it('name an answer by the callable, never by a payload field — accept and decline are separate entries', () => {
    expect(TeamInvitationTargetInputSchema.safeParse({ teamInvitationId: 'inv-1', response: 'approved' }).success).toBe(false);
    expect(Object.keys(schemas)).not.toContain('RespondToTeamInvitationInputSchema');
  });

  it('answer with the ids a client names its event by, an acceptance adding where its roster work stands', () => {
    const result = { leagueId: 'L1', teamId: 'T1', teamInvitationId: 'inv-1', invitedUserId: 'u1' };
    expect(TeamInvitationResultSchema.parse(result)).toEqual(result);
    expect(AcceptTeamInvitationResultSchema.parse({ ...result, rosterSyncStatus: 'pending' })).toMatchObject(result);
    expect(AcceptTeamInvitationResultSchema.safeParse(result).success).toBe(false);
  });
});

describe('the join-request wire contracts', () => {
  it('bound the message by the one declared limit, trimmed, at every length edge', () => {
    const at = (length: number) => CreateTeamJoinRequestInputSchema.safeParse({ teamId: 'T1', message: 'x'.repeat(length) });
    expect(at(MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH).success).toBe(true);
    expect(at(MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH).success).toBe(true);
    expect(at(MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH - 1).success).toBe(false);
    expect(at(MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH + 1).success).toBe(false);
    expect(
      CreateTeamJoinRequestInputSchema.safeParse({
        teamId: 'T1',
        message: ` ${'x'.repeat(MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH - 1)}         `,
      }).success,
    ).toBe(false);
  });

  it('never take the requester from the payload', () => {
    expect(
      CreateTeamJoinRequestInputSchema.safeParse({ teamId: 'T1', message: 'x'.repeat(20), userId: 'someone' }).success,
    ).toBe(false);
    expect(TeamJoinRequestTargetInputSchema.safeParse({ teamJoinRequestId: 'r1', userId: 'someone' }).success).toBe(false);
  });

  it('answer with the ids a client names its event by', () => {
    const result = { leagueId: 'L1', teamId: 'T1', teamJoinRequestId: 'r1', userId: 'u1' };
    expect(TeamJoinRequestResultSchema.parse(result)).toEqual(result);
    expect(AcceptTeamJoinRequestResultSchema.parse({ ...result, rosterSyncStatus: 'reconciled' })).toMatchObject(result);
  });
});

describe('the free-agent wire contracts', () => {
  it('a signup and a withdrawal name only the league — the player is the caller', () => {
    expect(LeagueFreeAgentInputSchema.parse({ leagueId: 'L1' })).toEqual({ leagueId: 'L1' });
    expect(LeagueFreeAgentInputSchema.safeParse({ leagueId: 'L1', userId: 'someone' }).success).toBe(false);
    expect(CreateLeagueFreeAgentResultSchema.parse({ leagueId: 'L1', userId: 'u1', createdAt: NOW }).createdAt).toBe(NOW);
    expect(DeleteLeagueFreeAgentResultSchema.parse({ leagueId: 'L1', userId: 'u1', deleted: false }).deleted).toBe(false);
  });

  it("the admin's assignment names the league, the player, and the team, and answers where the roster work stands", () => {
    const input = { leagueId: 'L1', userId: 'u1', teamId: 'T1' };
    expect(AdminAssignLeagueFreeAgentInputSchema.parse(input)).toEqual(input);
    expect(AdminAssignLeagueFreeAgentInputSchema.safeParse({ ...input, role: 'captain' }).success).toBe(false);
    expect(AdminAssignLeagueFreeAgentResultSchema.parse({ ...input, rosterSyncStatus: 'pending' })).toMatchObject(input);
  });
});

describe('the events a client names after each door', () => {
  it('declares an event for every change to the pending invitation, join-request, and free-agent lists', () => {
    for (const type of [
      'teamInvitation.sent',
      'teamInvitation.cancelled',
      'teamInvitation.answered',
      'teamJoinRequest.submitted',
      'teamJoinRequest.cancelled',
      'teamJoinRequest.answered',
    ]) {
      expect(DomainEventSchema.safeParse({ type, ids: { leagueId: 'L1', teamId: 'T1', userId: 'u1' } }).success).toBe(true);
      expect(DomainEventSchema.safeParse({ type, ids: { leagueId: 'L1', teamId: 'T1' } }).success).toBe(false);
    }
    for (const type of ['leagueFreeAgent.signedUp', 'leagueFreeAgent.removed']) {
      expect(DomainEventSchema.safeParse({ type, ids: { leagueId: 'L1', userId: 'u1' } }).success).toBe(true);
    }
  });
});

describe('the audit types each door records under', () => {
  it('declares one per action, success and refusal alike', () => {
    for (const type of [
      'teamInvitation.created',
      'teamInvitation.cancelled',
      'teamInvitation.accepted',
      'teamInvitation.rejected',
      'teamJoinRequest.created',
      'teamJoinRequest.cancelled',
      'teamJoinRequest.accepted',
      'teamJoinRequest.rejected',
      'leagueFreeAgent.created',
      'leagueFreeAgent.deleted',
      'leagueFreeAgent.assigned',
    ]) {
      expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain(type);
    }
  });
});

describe("the team's joinRevision", () => {
  it('is an optional count, absent on a team no invitation or request has touched', () => {
    const team = { name: 'Hoopers', icon: 'Shield', leagueId: 'L1', createdByUserId: 'u1', createdAt: NOW, updatedAt: NOW };
    expect(LeagueTeamSchema.safeParse(team).success).toBe(true);
    expect(LeagueTeamSchema.safeParse({ ...team, joinRevision: 3 }).success).toBe(true);
    expect(LeagueTeamSchema.safeParse({ ...team, joinRevision: -1 }).success).toBe(false);
  });
});
