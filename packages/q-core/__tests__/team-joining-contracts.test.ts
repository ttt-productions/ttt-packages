import { describe, it, expect } from 'vitest';
import {
  MAX_TEAM_INVITATION_MESSAGE_LENGTH,
  MAX_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
  MIN_TEAM_JOIN_REQUEST_MESSAGE_LENGTH,
} from '../src/constants/business.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  PENDING_TEAM_INVITATION_STATUS,
  PENDING_TEAM_JOIN_REQUEST_STATUS,
  TEAM_INVITATION_STATUS_KEYS,
  TEAM_JOIN_REQUEST_STATUS_KEYS,
} from '../src/types/unions.js';
import { LeagueTeamSchema } from '../src/doc-schemas/league-team.js';
import { TeamInvitationSchema, TeamJoinRequestSchema } from '../src/doc-schemas/team-membership.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import {
  AdminDeleteLeagueFreeAgentAssignInputSchema,
  AdminDeleteLeagueFreeAgentAssignResultSchema,
  CreateLeagueFreeAgentResultSchema,
  CreateTeamInvitationInputSchema,
  CreateTeamJoinRequestInputSchema,
  DeleteLeagueFreeAgentResultSchema,
  LeagueFreeAgentInputSchema,
  TeamInvitationClosedResultSchema,
  TeamInvitationResultSchema,
  TeamInvitationTargetInputSchema,
  TeamJoinRequestClosedResultSchema,
  TeamJoinRequestResultSchema,
  TeamJoinRequestTargetInputSchema,
} from '../src/schemas/team-joining.js';

const NOW = 1_712_345_678_901;

describe('the statuses an invitation and a join request hold', () => {
  it('an invitation is only ever pending — answering or withdrawing it deletes it', () => {
    expect([...TEAM_INVITATION_STATUS_KEYS]).toEqual([PENDING_TEAM_INVITATION_STATUS]);
  });

  it('a join request is only ever pending — answering or withdrawing it deletes it', () => {
    expect([...TEAM_JOIN_REQUEST_STATUS_KEYS]).toEqual([PENDING_TEAM_JOIN_REQUEST_STATUS]);
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
    for (const status of ['approved', 'rejected', 'cancelled', 'expired']) {
      expect(TeamInvitationSchema.safeParse({ ...invitation, status }).success).toBe(false);
    }
    expect(TeamInvitationSchema.parse({ ...invitation, respondedAt: NOW })).not.toHaveProperty(
      'respondedAt',
    );

    const request = {
      leagueId: 'L1',
      teamId: 'T1',
      userId: 'u1',
      message: 'x'.repeat(10),
      status: 'pending',
      createdAt: NOW,
    };
    for (const status of TEAM_JOIN_REQUEST_STATUS_KEYS) {
      expect(TeamJoinRequestSchema.safeParse({ ...request, status }).success).toBe(true);
    }
    for (const status of ['approved', 'rejected', 'cancelled']) {
      expect(TeamJoinRequestSchema.safeParse({ ...request, status }).success).toBe(false);
    }
  });
});

describe('the invitation wire contracts', () => {
  const valid = { teamId: 'T1', invitedUserId: 'u1', message: 'Come play with us.' };

  it('take the team, the invitee, and an optional note bounded by MAX_TEAM_INVITATION_MESSAGE_LENGTH, trimmed', () => {
    expect(CreateTeamInvitationInputSchema.parse({ ...valid, message: '  hi  ' }).message).toBe(
      'hi',
    );
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, message: '' }).success).toBe(true);
    expect(
      CreateTeamInvitationInputSchema.safeParse({
        ...valid,
        message: 'x'.repeat(MAX_TEAM_INVITATION_MESSAGE_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      CreateTeamInvitationInputSchema.safeParse({
        ...valid,
        message: 'x'.repeat(MAX_TEAM_INVITATION_MESSAGE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('never take the inviter or the league from the payload, and never a path segment holding a slash', () => {
    expect(
      CreateTeamInvitationInputSchema.safeParse({ ...valid, invitedByUserId: 'someone' }).success,
    ).toBe(false);
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, leagueId: 'L9' }).success).toBe(
      false,
    );
    expect(CreateTeamInvitationInputSchema.safeParse({ ...valid, teamId: 'T1/evil' }).success).toBe(
      false,
    );
    expect(TeamInvitationTargetInputSchema.safeParse({ teamInvitationId: 'a/b' }).success).toBe(
      false,
    );
  });

  it('name an answer by the callable, never by a payload field — accept and decline are separate entries', () => {
    expect(
      TeamInvitationTargetInputSchema.safeParse({ teamInvitationId: 'inv-1', response: 'approved' })
        .success,
    ).toBe(false);
  });

  it('answer with the ids a client names its event by, an acceptance with nothing more', () => {
    const result = { leagueId: 'L1', teamId: 'T1', teamInvitationId: 'inv-1', invitedUserId: 'u1' };
    expect(TeamInvitationResultSchema.parse(result)).toEqual(result);
    expect(
      TeamInvitationResultSchema.safeParse({ ...result, rosterSyncStatus: 'pending' }).success,
    ).toBe(false);
  });

  it('answer a decline or a withdrawal with the invitation id alone', () => {
    expect(TeamInvitationClosedResultSchema.parse({ teamInvitationId: 'inv-1' })).toEqual({
      teamInvitationId: 'inv-1',
    });
    expect(
      TeamInvitationClosedResultSchema.safeParse({ teamInvitationId: 'inv-1', teamId: 'T1' })
        .success,
    ).toBe(false);
  });
});

describe('the join-request wire contracts', () => {
  it('bound the message by the one declared limit, trimmed, at every length edge', () => {
    const at = (length: number) =>
      CreateTeamJoinRequestInputSchema.safeParse({ teamId: 'T1', message: 'x'.repeat(length) });
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
      CreateTeamJoinRequestInputSchema.safeParse({
        teamId: 'T1',
        message: 'x'.repeat(20),
        userId: 'someone',
      }).success,
    ).toBe(false);
    expect(
      TeamJoinRequestTargetInputSchema.safeParse({ teamJoinRequestId: 'r1', userId: 'someone' })
        .success,
    ).toBe(false);
  });

  it('answer with the ids a client names its event by', () => {
    const result = { leagueId: 'L1', teamId: 'T1', teamJoinRequestId: 'r1', userId: 'u1' };
    expect(TeamJoinRequestResultSchema.parse(result)).toEqual(result);
    expect(
      TeamJoinRequestResultSchema.safeParse({ ...result, rosterSyncStatus: 'reconciled' }).success,
    ).toBe(false);
  });

  it('answer a decline or a withdrawal with the join request id alone', () => {
    expect(TeamJoinRequestClosedResultSchema.parse({ teamJoinRequestId: 'r1' })).toEqual({
      teamJoinRequestId: 'r1',
    });
    expect(
      TeamJoinRequestClosedResultSchema.safeParse({ teamJoinRequestId: 'r1', userId: 'u1' })
        .success,
    ).toBe(false);
  });
});

describe('the free-agent wire contracts', () => {
  it('a signup and a withdrawal name only the league — the player is the caller', () => {
    expect(LeagueFreeAgentInputSchema.parse({ leagueId: 'L1' })).toEqual({ leagueId: 'L1' });
    expect(
      LeagueFreeAgentInputSchema.safeParse({ leagueId: 'L1', userId: 'someone' }).success,
    ).toBe(false);
    expect(
      CreateLeagueFreeAgentResultSchema.parse({ leagueId: 'L1', userId: 'u1', createdAt: NOW })
        .createdAt,
    ).toBe(NOW);
    expect(
      DeleteLeagueFreeAgentResultSchema.parse({ leagueId: 'L1', userId: 'u1', deleted: false })
        .deleted,
    ).toBe(false);
  });

  it("the admin's assignment names the league, the player, and the team, and answers with them alone", () => {
    const input = { leagueId: 'L1', userId: 'u1', teamId: 'T1' };
    expect(AdminDeleteLeagueFreeAgentAssignInputSchema.parse(input)).toEqual(input);
    expect(
      AdminDeleteLeagueFreeAgentAssignInputSchema.safeParse({ ...input, role: 'captain' }).success,
    ).toBe(false);
    expect(AdminDeleteLeagueFreeAgentAssignResultSchema.parse(input)).toEqual(input);
    expect(
      AdminDeleteLeagueFreeAgentAssignResultSchema.safeParse({
        ...input,
        rosterSyncStatus: 'pending',
      }).success,
    ).toBe(false);
  });
});

describe('the events a client names after each door', () => {
  it('declares an event for every change to the pending invitation, join-request, and free-agent lists', () => {
    for (const type of [
      'teamInvitation.created',
      'teamInvitation.cancelled',
      'teamInvitation.accepted',
      'teamInvitation.rejected',
      'teamJoinRequest.created',
      'teamJoinRequest.cancelled',
      'teamJoinRequest.accepted',
      'teamJoinRequest.rejected',
    ]) {
      expect(
        DomainEventSchema.safeParse({ type, ids: { leagueId: 'L1', teamId: 'T1', userId: 'u1' } })
          .success,
      ).toBe(true);
      expect(
        DomainEventSchema.safeParse({ type, ids: { leagueId: 'L1', teamId: 'T1' } }).success,
      ).toBe(false);
    }
    for (const type of ['leagueFreeAgent.created', 'leagueFreeAgent.deleted']) {
      expect(
        DomainEventSchema.safeParse({ type, ids: { leagueId: 'L1', userId: 'u1' } }).success,
      ).toBe(true);
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
    const team = {
      name: 'Hoopers',
      icon: 'Shield',
      leagueType: 'Basketball',
      leagueId: 'L1',
      createdByUserId: 'u1',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(LeagueTeamSchema.safeParse(team).success).toBe(true);
    expect(LeagueTeamSchema.safeParse({ ...team, joinRevision: 3 }).success).toBe(true);
    expect(LeagueTeamSchema.safeParse({ ...team, joinRevision: -1 }).success).toBe(false);
  });
});
