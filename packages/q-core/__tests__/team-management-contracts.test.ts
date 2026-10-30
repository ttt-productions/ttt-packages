import { describe, it, expect } from 'vitest';
import {
  GhostPlayerStatsOperationSchema,
  StatsOperationSchema,
} from '../src/doc-schemas/stats-operation.js';
import { LeagueTeamSchema } from '../src/doc-schemas/league-team.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import {
  buildGameDeletionOperationId,
  buildGhostLinkOperationId,
} from '../src/ids/stats-operation-ids.js';
import {
  AdminDeleteLeagueTeamInputSchema,
  AdminLinkClosedLeagueGhostPlayerInputSchema,
  AdminUpdateLeagueTeamCaptainInputSchema,
  AdminUpdateLeagueTeamContactInputSchema,
  AdminUpdateLeagueTeamNameInputSchema,
  AdminUpdateLeagueTeamTypeInputSchema,
  DeleteTeamGhostPlayerInputSchema,
  DeleteTeamMembershipInputSchema,
  LinkGhostPlayerInputSchema,
  UpdateTeamMembershipRoleInputSchema,
} from '../src/schemas/teams.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  CAPTAIN_TEAM_ROLES,
  MEMBER_ASSIGNABLE_TEAM_ROLES,
  TEAM_CAPTAIN_ROLE,
  TEAM_CO_CAPTAIN_ROLE,
  TEAM_PLAYER_ROLE,
  TEAM_ROLE_KEYS,
} from '../src/types/unions.js';

const GHOST = 'ghost_1760000000000_abcd';
const REASON = 'Added by mistake';

describe('the roles a member role change moves between', () => {
  it('are exactly co-captain and player: the captain moves only through the captain change', () => {
    expect([...MEMBER_ASSIGNABLE_TEAM_ROLES].sort()).toEqual(
      [TEAM_CO_CAPTAIN_ROLE, TEAM_PLAYER_ROLE].sort(),
    );
    expect(MEMBER_ASSIGNABLE_TEAM_ROLES).not.toContain(TEAM_CAPTAIN_ROLE);
  });

  it('name the stored role values exactly, coCaptain camel-cased (RULE-QS-BACKEND-902)', () => {
    expect(TEAM_CO_CAPTAIN_ROLE).toBe('coCaptain');
    expect(TEAM_PLAYER_ROLE).toBe('player');
    for (const role of MEMBER_ASSIGNABLE_TEAM_ROLES) expect(TEAM_ROLE_KEYS).toContain(role);
    expect(CAPTAIN_TEAM_ROLES).toContain(TEAM_CO_CAPTAIN_ROLE);
  });
});

describe('the team-management inputs', () => {
  it('a role change takes the two member roles and refuses captain and any other spelling', () => {
    for (const role of MEMBER_ASSIGNABLE_TEAM_ROLES) {
      expect(
        UpdateTeamMembershipRoleInputSchema.safeParse({ teamId: 't', userId: 'u', role }).success,
      ).toBe(true);
    }
    for (const role of [TEAM_CAPTAIN_ROLE, 'cocaptain', 'member']) {
      expect(
        UpdateTeamMembershipRoleInputSchema.safeParse({ teamId: 't', userId: 'u', role }).success,
      ).toBe(false);
    }
  });

  it('a member removal takes a real account and refuses a ghost id; a ghost removal the reverse', () => {
    expect(DeleteTeamMembershipInputSchema.safeParse({ teamId: 't', userId: 'u' }).success).toBe(
      true,
    );
    expect(DeleteTeamMembershipInputSchema.safeParse({ teamId: 't', userId: GHOST }).success).toBe(
      false,
    );
    expect(
      DeleteTeamGhostPlayerInputSchema.safeParse({ teamId: 't', ghostUserId: GHOST }).success,
    ).toBe(true);
    expect(
      DeleteTeamGhostPlayerInputSchema.safeParse({ teamId: 't', ghostUserId: 'u' }).success,
    ).toBe(false);
  });

  it('a ghost removal and a team deletion take no reason, and refuse one', () => {
    expect(
      DeleteTeamGhostPlayerInputSchema.safeParse({ teamId: 't', ghostUserId: GHOST }).success,
    ).toBe(true);
    expect(
      DeleteTeamGhostPlayerInputSchema.safeParse({
        teamId: 't',
        ghostUserId: GHOST,
        reason: REASON,
      }).success,
    ).toBe(false);
    expect(AdminDeleteLeagueTeamInputSchema.safeParse({ teamId: 't' }).success).toBe(true);
    expect(
      AdminDeleteLeagueTeamInputSchema.safeParse({ teamId: 't', reason: REASON }).success,
    ).toBe(false);
  });

  it('a rename trims the name and refuses a blank one; a type change takes TEAM_TYPE_KEYS only', () => {
    expect(
      AdminUpdateLeagueTeamNameInputSchema.parse({ teamId: 't', name: '  Net Rippers ' }).name,
    ).toBe('Net Rippers');
    expect(
      AdminUpdateLeagueTeamNameInputSchema.safeParse({ teamId: 't', name: '   ' }).success,
    ).toBe(false);
    expect(
      AdminUpdateLeagueTeamTypeInputSchema.safeParse({ teamId: 't', teamType: 'Competitive' })
        .success,
    ).toBe(true);
    expect(
      AdminUpdateLeagueTeamTypeInputSchema.safeParse({ teamId: 't', teamType: 'Elite' }).success,
    ).toBe(false);
  });

  it('a contact edit trims the phone and refuses a blank one', () => {
    expect(
      AdminUpdateLeagueTeamContactInputSchema.parse({ teamId: 't', contactPhone: ' 555-0100 ' })
        .contactPhone,
    ).toBe('555-0100');
    expect(
      AdminUpdateLeagueTeamContactInputSchema.safeParse({ teamId: 't', contactPhone: ' ' }).success,
    ).toBe(false);
  });

  it('every input is strict and refuses a target that is not one document id', () => {
    expect(
      AdminUpdateLeagueTeamCaptainInputSchema.safeParse({
        teamId: 't',
        captainUserId: 'u',
        role: 'captain',
      }).success,
    ).toBe(false);
    expect(DeleteTeamMembershipInputSchema.safeParse({ teamId: 'a/b', userId: 'u' }).success).toBe(
      false,
    );
    expect(AdminDeleteLeagueTeamInputSchema.safeParse({ teamId: '' }).success).toBe(false);
  });
});

describe("a ghost's one operation", () => {
  it('has one id per team and ghost, apart from any game deletion', () => {
    expect(buildGhostLinkOperationId('team-1', GHOST)).toBe(
      buildGhostLinkOperationId('team-1', GHOST),
    );
    expect(buildGhostLinkOperationId('team-1', GHOST)).not.toBe(
      buildGhostLinkOperationId('team-2', GHOST),
    );
    expect(buildGhostLinkOperationId('team-1', GHOST)).not.toBe(
      buildGameDeletionOperationId('team-1'),
    );
  });

  it("records a removal's finished-game entries, and parses as a stats operation", () => {
    const removal = {
      kind: 'ghostPlayerStats',
      scope: { action: 'removal', teamId: 'team-1', ghostUserId: GHOST },
      startedByUserId: 'captain-1',
      startedAt: 1,
      updatedAt: 2,
      status: 'running',
      counts: { read: 1, changed: 1, skipped: 0 },
      removedFinishedGameEntries: [{ gameId: 'g1', wasAbsent: true, wasNonScoring: true }],
    };
    expect(GhostPlayerStatsOperationSchema.safeParse(removal).success).toBe(true);
    expect(StatsOperationSchema.safeParse(removal).success).toBe(true);
    expect(
      GhostPlayerStatsOperationSchema.safeParse({
        ...removal,
        removedFinishedGameEntries: [{ gameId: 'g1' }],
      }).success,
    ).toBe(false);
  });

  it('records the open games a paged removal has taken the ghost off so far', () => {
    const removal = {
      kind: 'ghostPlayerStats',
      scope: { action: 'removal', teamId: 'team-1', ghostUserId: GHOST },
      startedByUserId: 'captain-1',
      startedAt: 1,
      updatedAt: 2,
      status: 'running',
      counts: { read: 2, changed: 2, skipped: 0 },
      removedOpenGameIds: ['g1', 'g2'],
    };
    expect(StatsOperationSchema.safeParse(removal).success).toBe(true);
    expect(
      GhostPlayerStatsOperationSchema.safeParse({ ...removal, removedOpenGameIds: [''] }).success,
    ).toBe(false);
  });

  it('takes no reason on a link or a removal, and still reads an operation stored with one', () => {
    const removal = {
      kind: 'ghostPlayerStats',
      scope: { action: 'removal', teamId: 'team-1', ghostUserId: GHOST },
      startedByUserId: 'captain-1',
      startedAt: 1,
      updatedAt: 2,
      status: 'running',
      counts: { read: 0, changed: 0, skipped: 0 },
    };
    const link = {
      ...removal,
      scope: { action: 'link', teamId: 'team-1', ghostUserId: GHOST, userId: 'real-1' },
    };
    expect(StatsOperationSchema.safeParse(link).success).toBe(true);
    const storedWithReason = StatsOperationSchema.safeParse({ ...removal, reason: REASON });
    expect(storedWithReason.success).toBe(true);
    expect(storedWithReason.data).not.toHaveProperty('reason');
    expect(StatsOperationSchema.safeParse({ ...link, reason: REASON }).success).toBe(true);
  });

  it('a link names the team, the ghost, and the account, and refuses a reason', () => {
    const input = { teamId: 'team-1', ghostUserId: GHOST, userId: 'real-1' };
    expect(LinkGhostPlayerInputSchema.safeParse(input).success).toBe(true);
    expect(LinkGhostPlayerInputSchema.safeParse({ ...input, reason: REASON }).success).toBe(false);
    expect(
      AdminLinkClosedLeagueGhostPlayerInputSchema.safeParse({ ...input, reason: REASON }).success,
    ).toBe(false);
  });
});

describe("a team's schedule revision", () => {
  const team = {
    name: 'Hoopers',
    icon: 'Shield',
    leagueId: 'league-1',
    createdByUserId: 'creator-1',
    createdAt: 1,
    updatedAt: 1,
  };

  it('is optional, so a team no game was created against parses, and counts from zero', () => {
    expect(LeagueTeamSchema.parse(team)).not.toHaveProperty('scheduleRevision');
    expect(LeagueTeamSchema.parse({ ...team, scheduleRevision: 3 }).scheduleRevision).toBe(3);
    expect(LeagueTeamSchema.safeParse({ ...team, scheduleRevision: -1 }).success).toBe(false);
  });
});

describe('the events team management names', () => {
  it('declares an audit type for every team-management action and exit', () => {
    for (const type of [
      'teamMembership.roleChanged',
      'teamMembership.removed',
      'ghostPlayer.removed',
      'ghostPlayer.removalStopped',
      'leagueTeam.captainChanged',
      'leagueTeam.updated',
      'leagueTeamContact.updated',
      'leagueTeam.deleted',
    ]) {
      expect(AUDIT_EVENT_TYPE_KEYS).toContain(type);
    }
  });

  it('declares the deletion and the contact change as domain events the client maps to its reads', () => {
    const ids = { leagueId: 'league-1', teamId: 'team-1' };
    expect(DomainEventSchema.safeParse({ type: 'leagueTeam.deleted', ids }).success).toBe(true);
    expect(DomainEventSchema.safeParse({ type: 'leagueTeamContact.updated', ids }).success).toBe(
      true,
    );
    expect(
      DomainEventSchema.safeParse({ type: 'leagueTeam.deleted', ids: { teamId: 'team-1' } })
        .success,
    ).toBe(false);
  });

  it('declares a deletion that stopped short, and a ghost removal that left finished games, as domain events', () => {
    const ids = { leagueId: 'league-1', teamId: 'team-1' };
    expect(DomainEventSchema.safeParse({ type: 'leagueTeam.deletionAdvanced', ids }).success).toBe(
      true,
    );
    expect(
      DomainEventSchema.safeParse({
        type: 'ghostPlayer.finishedEntriesRemoved',
        ids: { ...ids, ghostUserId: 'ghost_1_ben' },
      }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({ type: 'ghostPlayer.finishedEntriesRemoved', ids }).success,
    ).toBe(false);
  });
});
