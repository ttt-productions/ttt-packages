// The contracts team creation, ghost add, the membership and roster cores, the join warning, and
// waiver signing are built on. Each test pins a property a core or a door relies on.

import { describe, it, expect } from 'vitest';
import {
  MAX_CONTACT_PHONE_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  MIN_TEAM_NAME_LENGTH,
  TEAM_CREATION_CUTOFF_DAYS,
} from '../src/constants/business.js';
import { LeagueTeamContactSchema, LeagueTeamSchema } from '../src/doc-schemas/league-team.js';
import { MembershipRosterSyncSchema } from '../src/doc-schemas/membership-roster-sync.js';
import { SignedWaiverSchema } from '../src/doc-schemas/waivers-and-hardware.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import { buildGhostUserId, buildGhostUserIdForRequest, isGhostUserId } from '../src/ids/minted-ids.js';
import { buildTeamMembershipId, parseTeamMembershipId } from '../src/ids/compound-ids.js';
import { COLLECTIONS } from '../src/paths/collections.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import {
  AdminCreateLeagueTeamInputSchema,
  AdminRetryLeagueTeamRosterSyncInputSchema,
  CreateGameGhostPlayerInputSchema,
  CreateGhostPlayerResultSchema,
  CreateLeagueTeamInputSchema,
  CreateTeamGhostPlayerInputSchema,
  GetLeagueJoinWarningInputSchema,
  GetLeagueJoinWarningResultSchema,
} from '../src/schemas/teams.js';
import {
  AdminCreateSignedWaiverInputSchema,
  CreateSignedWaiverInputSchema,
  GetSignedWaiverFileInputSchema,
} from '../src/schemas/signed-waivers.js';
import { AdminStartUploadInputSchema } from '../src/schemas/uploads.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  ACTIVE_TEAM_MEMBERSHIP_STATUS,
  APPROVED_TEAM_INVITATION_STATUS,
  APPROVED_TEAM_JOIN_REQUEST_STATUS,
  CAPTAIN_TEAM_ROLES,
  FAILED_ROSTER_SYNC_STATUS,
  MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS,
  OPEN_GAME_STATUS_KEYS,
  GAME_STATUS_KEYS,
  COMPLETED_GAME_STATUS,
  PENDING_ROSTER_SYNC_STATUS,
  PENDING_TEAM_INVITATION_STATUS,
  PENDING_TEAM_JOIN_REQUEST_STATUS,
  RECONCILED_ROSTER_SYNC_STATUS,
  TEAM_CAPTAIN_ROLE,
  TEAM_INVITATION_STATUS_KEYS,
  TEAM_JOIN_REQUEST_STATUS_KEYS,
  TEAM_MEMBERSHIP_STATUS_KEYS,
  WAIVER_WITNESS_AUTHORITY_KEYS,
  isOpenGameStatus,
} from '../src/types/unions.js';
import { addCalendarDays, toLeagueDayKey } from '../src/utils/league-calendar.js';
import { isTeamCreationOpen, teamCreationLastDay } from '../src/utils/team-creation.js';
import {
  LEAGUE_JOIN_WARNING_ACTION_KEYS,
  LEAGUE_JOIN_WARNING_COPY,
  LEAGUE_JOIN_WARNING_PERSPECTIVE_BY_ACTION,
  LEAGUE_JOIN_WARNING_STATE_KEYS,
  computeLeagueJoinWarning,
  formatLeagueJoinWarning,
  leagueJoinWarningActedOnSchema,
  leagueJoinWarningFindingSchema,
} from '../src/utils/league-join-warning.js';
import type { LeagueJoinWarningFacts } from '../src/utils/league-join-warning.js';

const NOW = 1_712_345_678_901;
const STAGING_PATH = 'uploads/waiver-signature/signer-1/2f1c0a3e-8b1d-4c6f-9a2e-5d7b3c1e9f00';
// The wording the signing dialog displayed.
const SHOWN = { waiverTemplateId: 'waiver-1', waiverTemplateVersion: 2 };

const none: LeagueJoinWarningFacts = {
  memberships: [],
  pendingJoinRequests: [],
  pendingInvitations: [],
  freeAgentSignup: false,
};

describe('the team-creation window', () => {
  const START = '2026-03-01';

  it('closes TEAM_CREATION_CUTOFF_DAYS calendar days after the league starts, that day included', () => {
    expect(TEAM_CREATION_CUTOFF_DAYS).toBe(14);
    expect(teamCreationLastDay(START)).toBe('2026-03-15');
    expect(isTeamCreationOpen(START, addCalendarDays(START, 13))).toBe(true);
    expect(isTeamCreationOpen(START, addCalendarDays(START, 14))).toBe(true);
    expect(isTeamCreationOpen(START, addCalendarDays(START, 15))).toBe(false);
  });

  it('is open before the league starts', () => {
    expect(isTeamCreationOpen(START, '2026-02-01')).toBe(true);
  });

  it('counts calendar days across a month end and a daylight-saving change', () => {
    expect(addCalendarDays('2026-02-20', 14)).toBe('2026-03-06');
    expect(addCalendarDays('2026-03-05', 14)).toBe('2026-03-19');
    expect(addCalendarDays('2026-03-19', -14)).toBe('2026-03-05');
  });

  it('refuses a value that is not a calendar date', () => {
    expect(() => addCalendarDays('not-a-date', 1)).toThrow(RangeError);
  });

  it("reads today in the leagues' own time zone, not UTC", () => {
    // 03:30 UTC on 2026-03-16 is still the evening of 2026-03-15 in New York.
    expect(toLeagueDayKey(Date.UTC(2026, 2, 16, 3, 30))).toBe('2026-03-15');
    expect(toLeagueDayKey(Date.UTC(2026, 2, 16, 12, 0))).toBe('2026-03-16');
  });
});

describe('computeLeagueJoinWarning', () => {
  it('finds nothing when the person stands nowhere in the league', () => {
    expect(computeLeagueJoinWarning(none, null)).toEqual([]);
  });

  it('names each of the four states on its own', () => {
    expect(computeLeagueJoinWarning({ ...none, memberships: [{ teamId: 'A' }] }, null)).toEqual([
      { state: 'onTeam', teamId: 'A' },
    ]);
    expect(
      computeLeagueJoinWarning({ ...none, pendingJoinRequests: [{ teamJoinRequestId: 'r1', teamId: 'B' }] }, null),
    ).toEqual([{ state: 'pendingJoinRequest', teamId: 'B' }]);
    expect(
      computeLeagueJoinWarning({ ...none, pendingInvitations: [{ teamInvitationId: 'i1', teamId: 'C' }] }, null),
    ).toEqual([{ state: 'pendingInvitation', teamId: 'C' }]);
    expect(computeLeagueJoinWarning({ ...none, freeAgentSignup: true }, null)).toEqual([
      { state: 'freeAgentSignup', teamId: null },
    ]);
  });

  it('names several states at once, in state order and then team order', () => {
    const findings = computeLeagueJoinWarning(
      {
        memberships: [{ teamId: 'Z' }, { teamId: 'A' }],
        pendingJoinRequests: [{ teamJoinRequestId: 'r1', teamId: 'B' }],
        pendingInvitations: [{ teamInvitationId: 'i1', teamId: 'C' }],
        freeAgentSignup: true,
      },
      null,
    );
    expect(findings).toEqual([
      { state: 'onTeam', teamId: 'A' },
      { state: 'onTeam', teamId: 'Z' },
      { state: 'pendingJoinRequest', teamId: 'B' },
      { state: 'pendingInvitation', teamId: 'C' },
      { state: 'freeAgentSignup', teamId: null },
    ]);
  });

  it('leaves out the item the door acts on, and only that item', () => {
    const facts: LeagueJoinWarningFacts = {
      memberships: [],
      pendingJoinRequests: [
        { teamJoinRequestId: 'r1', teamId: 'A' },
        { teamJoinRequestId: 'r2', teamId: 'B' },
      ],
      pendingInvitations: [
        { teamInvitationId: 'i1', teamId: 'C' },
        { teamInvitationId: 'i2', teamId: 'D' },
      ],
      freeAgentSignup: true,
    };

    expect(computeLeagueJoinWarning(facts, { kind: 'teamInvitation', teamInvitationId: 'i1' })).toEqual([
      { state: 'pendingJoinRequest', teamId: 'A' },
      { state: 'pendingJoinRequest', teamId: 'B' },
      { state: 'pendingInvitation', teamId: 'D' },
      { state: 'freeAgentSignup', teamId: null },
    ]);
    expect(computeLeagueJoinWarning(facts, { kind: 'teamJoinRequest', teamJoinRequestId: 'r2' })).toEqual([
      { state: 'pendingJoinRequest', teamId: 'A' },
      { state: 'pendingInvitation', teamId: 'C' },
      { state: 'pendingInvitation', teamId: 'D' },
      { state: 'freeAgentSignup', teamId: null },
    ]);
    expect(computeLeagueJoinWarning(facts, { kind: 'leagueFreeAgent' })).not.toContainEqual({
      state: 'freeAgentSignup',
      teamId: null,
    });
  });

  it('declares exactly the four states the design names', () => {
    expect([...LEAGUE_JOIN_WARNING_STATE_KEYS]).toEqual([
      'onTeam',
      'pendingJoinRequest',
      'pendingInvitation',
      'freeAgentSignup',
    ]);
  });
});

describe('LEAGUE_JOIN_WARNING_COPY', () => {
  it('phrases every door for the person themself or for someone acting on them', () => {
    for (const action of LEAGUE_JOIN_WARNING_ACTION_KEYS) {
      expect(['self', 'other']).toContain(LEAGUE_JOIN_WARNING_PERSPECTIVE_BY_ACTION[action]);
      expect(typeof LEAGUE_JOIN_WARNING_COPY.question[action]).toBe('function');
    }
    expect(LEAGUE_JOIN_WARNING_PERSPECTIVE_BY_ACTION.createTeam).toBe('self');
    expect(LEAGUE_JOIN_WARNING_PERSPECTIVE_BY_ACTION.sendInvitation).toBe('other');
  });

  it("words the person's own warning with every state found and the door's question", () => {
    const text = formatLeagueJoinWarning({
      action: 'acceptInvitation',
      findings: [{ state: 'pendingJoinRequest', teamId: 'team-1' }],
      teamName: () => 'TEAM 1',
      personName: 'JORDAN',
      targetTeamName: 'TEAM 2',
    });
    expect(text).toEqual({
      lines: ['You have a request waiting with TEAM 1.'],
      question: 'Do you still want to join TEAM 2?',
    });
  });

  it("words a warning about someone else with that person's name", () => {
    const text = formatLeagueJoinWarning({
      action: 'acceptJoinRequest',
      findings: [
        { state: 'onTeam', teamId: 'team-2' },
        { state: 'freeAgentSignup', teamId: null },
      ],
      teamName: () => 'TEAM 2',
      personName: 'JORDAN',
      targetTeamName: 'TEAM 1',
    });
    expect(text.lines).toEqual([
      'JORDAN is already on TEAM 2.',
      'JORDAN is signed up as a free agent in this league.',
    ]);
    expect(text.question).toBe('Accept them onto TEAM 1 anyway?');
  });
});

describe('team creation input', () => {
  const valid = {
    leagueId: 'league-1',
    name: 'Hoopers',
    icon: 'Shield',
    contactPhone: '555-0100',
  };

  it('requires the contact phone, bounded by MAX_CONTACT_PHONE_LENGTH', () => {
    expect(CreateLeagueTeamInputSchema.safeParse(valid).success).toBe(true);
    const { contactPhone: _omitted, ...withoutPhone } = valid;
    expect(CreateLeagueTeamInputSchema.safeParse(withoutPhone).success).toBe(false);
    expect(CreateLeagueTeamInputSchema.safeParse({ ...valid, contactPhone: '   ' }).success).toBe(false);
    expect(
      CreateLeagueTeamInputSchema.safeParse({ ...valid, contactPhone: '5'.repeat(MAX_CONTACT_PHONE_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('holds the name to the one length rule, measured after trimming', () => {
    expect(CreateLeagueTeamInputSchema.safeParse({ ...valid, name: 'a'.repeat(MIN_TEAM_NAME_LENGTH) }).success).toBe(true);
    expect(CreateLeagueTeamInputSchema.safeParse({ ...valid, name: ` ${'a'.repeat(MIN_TEAM_NAME_LENGTH - 1)} ` }).success).toBe(
      false,
    );
    expect(CreateLeagueTeamInputSchema.safeParse({ ...valid, name: 'a'.repeat(MAX_TEAM_NAME_LENGTH + 1) }).success).toBe(
      false,
    );
  });

  it('takes no creator, captain id, or team fields the server owns', () => {
    for (const smuggled of [{ createdByUserId: 'x' }, { captainUserId: 'x' }, { seasonStats: {} }, { pictures: {} }]) {
      expect(CreateLeagueTeamInputSchema.safeParse({ ...valid, ...smuggled }).success).toBe(false);
    }
  });

  it("asks the admin door for the ghost captain's name, never an id", () => {
    expect(AdminCreateLeagueTeamInputSchema.safeParse({ ...valid, captainDisplayName: 'Ghost Captain' }).success).toBe(
      true,
    );
    expect(AdminCreateLeagueTeamInputSchema.safeParse(valid).success).toBe(false);
    expect(
      AdminCreateLeagueTeamInputSchema.safeParse({ ...valid, captainDisplayName: 'Ghost', captainUserId: 'ghost_1_a' })
        .success,
    ).toBe(false);
  });
});

describe('ghost add input', () => {
  it('validates the ghost name on the server and takes no ghost id or creator', () => {
    expect(CreateTeamGhostPlayerInputSchema.safeParse({ teamId: 't', requestId: 'r1', displayName: 'Red Shirt' }).success).toBe(true);
    expect(
      CreateTeamGhostPlayerInputSchema.safeParse({ teamId: 't', requestId: 'r1', displayName: 'a'.repeat(MIN_DISPLAY_NAME_LENGTH - 1) })
        .success,
    ).toBe(false);
    expect(
      CreateTeamGhostPlayerInputSchema.safeParse({ teamId: 't', requestId: 'r1', displayName: 'a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1) })
        .success,
    ).toBe(false);
    for (const smuggled of [{ ghostUserId: 'ghost_1_a' }, { createdBy: 'u1' }, { leagueId: 'l1' }]) {
      expect(CreateTeamGhostPlayerInputSchema.safeParse({ teamId: 't', requestId: 'r1', displayName: 'Red Shirt', ...smuggled }).success).toBe(
        false,
      );
    }
  });

  it('names the game and one of its teams at the game door', () => {
    expect(
      CreateGameGhostPlayerInputSchema.safeParse({ gameId: 'g', teamId: 't', displayName: 'Red Shirt', requestId: 'r1' }).success,
    ).toBe(true);
    expect(CreateGameGhostPlayerInputSchema.safeParse({ gameId: 'g', displayName: 'Red Shirt', requestId: 'r1' }).success).toBe(false);
  });

  it('carries the request id the client minted for this add, one document-id segment, at both doors', () => {
    const add = { teamId: 't', displayName: 'Red Shirt' };
    expect(CreateTeamGhostPlayerInputSchema.safeParse(add).success).toBe(false);
    for (const requestId of ['', 'a/b', '..', 'x'.repeat(1500)]) {
      expect(CreateTeamGhostPlayerInputSchema.safeParse({ ...add, requestId }).success).toBe(false);
      expect(CreateGameGhostPlayerInputSchema.safeParse({ ...add, gameId: 'g', requestId }).success).toBe(false);
    }
    expect(CreateGameGhostPlayerInputSchema.safeParse({ ...add, gameId: 'g' }).success).toBe(false);
  });

  it("answers with the ghost and where its roster work stood", () => {
    for (const status of MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS) {
      expect(
        CreateGhostPlayerResultSchema.safeParse({
          leagueId: 'l',
          teamId: 't',
          ghostUserId: buildGhostUserId(NOW, 'abc'),
          rosterSyncStatus: status,
        }).success,
      ).toBe(true);
    }
  });
});

describe('ghost identity', () => {
  it('derives one ghost per add request: a retry of the request names the same ghost, another request another', () => {
    const ghost = buildGhostUserIdForRequest('7f3e2a10-1b2c-4d5e-8f90-a1b2c3d4e5f6');
    expect(isGhostUserId(ghost)).toBe(true);
    expect(buildGhostUserIdForRequest('7f3e2a10-1b2c-4d5e-8f90-a1b2c3d4e5f6')).toBe(ghost);
    expect(buildGhostUserIdForRequest('0c9d8e7f-6a5b-4c3d-9e2f-1a0b9c8d7e6f')).not.toBe(ghost);
    expect(ghost).not.toBe(buildGhostUserId(NOW, '7f3e2a10-1b2c-4d5e-8f90-a1b2c3d4e5f6'));
  });

  it('mints one ghost id format, whose parts the membership parser keeps whole', () => {
    const ghost = buildGhostUserId(NOW, 'a1b2c3');
    expect(isGhostUserId(ghost)).toBe(true);
    expect(parseTeamMembershipId(buildTeamMembershipId('league', 'team', ghost))).toEqual({
      leagueId: 'league',
      teamId: 'team',
      userId: ghost,
    });
  });
});

describe('the join warning callables', () => {
  it('take the acted-on item and return the findings in the one shape the warning computes over', () => {
    expect(GetLeagueJoinWarningInputSchema.shape.actedOn.unwrap()).toBe(leagueJoinWarningActedOnSchema);
    expect(GetLeagueJoinWarningResultSchema.shape.findings.element).toBe(leagueJoinWarningFindingSchema);
    for (const finding of computeLeagueJoinWarning(
      { memberships: [{ teamId: 'A' }], pendingJoinRequests: [], pendingInvitations: [], freeAgentSignup: true },
      null,
    )) {
      expect(leagueJoinWarningFindingSchema.safeParse(finding).success).toBe(true);
    }
  });

  it('reads about one person in one league, optionally for a target team and an acted-on item', () => {
    expect(GetLeagueJoinWarningInputSchema.safeParse({ leagueId: 'l', userId: 'u' }).success).toBe(true);
    expect(
      GetLeagueJoinWarningInputSchema.safeParse({
        leagueId: 'l',
        userId: 'u',
        targetTeamId: 't',
        actedOn: { kind: 'teamInvitation', teamInvitationId: 'i1' },
      }).success,
    ).toBe(true);
    expect(
      GetLeagueJoinWarningInputSchema.safeParse({ leagueId: 'l', userId: 'u', actedOn: { kind: 'teamInvitation' } })
        .success,
    ).toBe(false);
  });

  it('returns nothing beyond the four states, each with its team', () => {
    expect(
      GetLeagueJoinWarningResultSchema.safeParse({
        leagueId: 'l',
        userId: 'u',
        findings: [{ state: 'onTeam', teamId: 't' }],
      }).success,
    ).toBe(true);
    expect(
      GetLeagueJoinWarningResultSchema.safeParse({
        leagueId: 'l',
        userId: 'u',
        findings: [{ state: 'onTeam', teamId: 't', message: 'pending request text' }],
      }).success,
    ).toBe(false);
  });
});

describe('leagueTeams and its contact document', () => {
  const team = {
    name: 'Hoopers',
    icon: 'Shield',
    leagueId: 'league-1',
    createdByUserId: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('keeps no contact detail on the public team document', () => {
    expect(LeagueTeamSchema.safeParse(team).success).toBe(true);
    expect(Object.keys(LeagueTeamSchema.shape)).not.toContain('contactPhone');
  });

  it('refuses a null team type — "no type" is the absent field', () => {
    expect(LeagueTeamSchema.safeParse({ ...team, teamType: null }).success).toBe(false);
    expect(LeagueTeamSchema.safeParse({ ...team, teamType: 'Recreational' }).success).toBe(true);
  });

  it("holds the team's contact phone on its admin-only document, keyed by the team, naming its league", () => {
    expect(LeagueTeamContactSchema.safeParse({ leagueId: 'L', contactPhone: '555-0100', updatedAt: NOW }).success).toBe(true);
    expect(LeagueTeamContactSchema.safeParse({ leagueId: 'L', contactPhone: '', updatedAt: NOW }).success).toBe(false);
    expect(LeagueTeamContactSchema.safeParse({ contactPhone: '555-0100', updatedAt: NOW }).success).toBe(false);
    expect(toPath(PATH_BUILDERS.leagueTeamContact('T'))).toBe(toPath([COLLECTIONS.LEAGUE_TEAM_CONTACTS, 'T']));
  });
});

describe('membershipRosterSyncs', () => {
  const pending = {
    leagueId: 'L',
    teamId: 'T',
    userId: 'u1',
    rosterRevision: 2,
    reconciledRosterRevision: 1,
    syncStatus: 'pending',
    attemptCount: 0,
    nextAttemptAt: NOW,
    updatedAt: NOW,
  };

  it('is keyed by the membership id — no second id format', () => {
    expect(toPath(PATH_BUILDERS.membershipRosterSync('L', 'T', 'u1'))).toBe(
      `membershipRosterSyncs/${buildTeamMembershipId('L', 'T', 'u1')}`,
    );
  });

  it('accepts a pending obligation and a reconciled one', () => {
    expect(MembershipRosterSyncSchema.safeParse(pending).success).toBe(true);
    expect(
      MembershipRosterSyncSchema.safeParse({ ...pending, reconciledRosterRevision: 2, syncStatus: 'reconciled' }).success,
    ).toBe(true);
  });

  it('refuses a reconciled revision past its own revision', () => {
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, reconciledRosterRevision: 3 }).success).toBe(false);
  });

  it('is reconciled exactly when the reconciled revision reaches the revision', () => {
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, syncStatus: 'reconciled' }).success).toBe(false);
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, reconciledRosterRevision: 2 }).success).toBe(false);
  });

  it('carries failedAt exactly while failed', () => {
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, syncStatus: 'failed' }).success).toBe(false);
    expect(
      MembershipRosterSyncSchema.safeParse({ ...pending, syncStatus: 'failed', failedAt: NOW, attemptCount: 5 }).success,
    ).toBe(true);
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, failedAt: NOW }).success).toBe(false);
  });

  it('refuses a negative or fractional attempt count', () => {
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, attemptCount: -1 }).success).toBe(false);
    expect(MembershipRosterSyncSchema.safeParse({ ...pending, attemptCount: 1.5 }).success).toBe(false);
  });

  it('asks the admin retry for a team only', () => {
    expect(AdminRetryLeagueTeamRosterSyncInputSchema.safeParse({ teamId: 'T' }).success).toBe(true);
    expect(AdminRetryLeagueTeamRosterSyncInputSchema.safeParse({ teamId: 'T', leagueId: 'L' }).success).toBe(false);
  });
});

describe('open games', () => {
  it('names the open statuses explicitly, and the completed status is not one', () => {
    expect([...OPEN_GAME_STATUS_KEYS]).toEqual(['scheduled', 'inprogress']);
    expect(OPEN_GAME_STATUS_KEYS as readonly string[]).not.toContain(COMPLETED_GAME_STATUS);
    for (const status of OPEN_GAME_STATUS_KEYS) expect(GAME_STATUS_KEYS as readonly string[]).toContain(status);
  });

  it('answers whether a game is open through the one predicate both app roots ask', () => {
    for (const status of GAME_STATUS_KEYS) {
      expect(isOpenGameStatus(status)).toBe((OPEN_GAME_STATUS_KEYS as readonly string[]).includes(status));
    }
    expect(isOpenGameStatus(COMPLETED_GAME_STATUS)).toBe(false);
  });
});

describe('the status members every query and write names', () => {
  it('names each queried or written member of its own union', () => {
    expect(TEAM_MEMBERSHIP_STATUS_KEYS as readonly string[]).toContain(ACTIVE_TEAM_MEMBERSHIP_STATUS);
    expect(TEAM_INVITATION_STATUS_KEYS as readonly string[]).toEqual(
      expect.arrayContaining([PENDING_TEAM_INVITATION_STATUS, APPROVED_TEAM_INVITATION_STATUS]),
    );
    expect(TEAM_JOIN_REQUEST_STATUS_KEYS as readonly string[]).toEqual(
      expect.arrayContaining([PENDING_TEAM_JOIN_REQUEST_STATUS, APPROVED_TEAM_JOIN_REQUEST_STATUS]),
    );
    expect([PENDING_ROSTER_SYNC_STATUS, RECONCILED_ROSTER_SYNC_STATUS, FAILED_ROSTER_SYNC_STATUS].sort()).toEqual(
      [...MEMBERSHIP_ROSTER_SYNC_STATUS_KEYS].sort(),
    );
    expect(CAPTAIN_TEAM_ROLES as readonly string[]).toContain(TEAM_CAPTAIN_ROLE);
  });
});

describe('signed waivers', () => {
  const own = {
    leagueId: 'L',
    userId: 'u1',
    waiverTemplateId: 'w1',
    waiverTemplateVersion: 3,
    waiverTitleSnapshot: 'Release',
    waiverTextSnapshot: '',
    signatureFile: { bucket: 'b', path: 'users/u1/waiverSigs/L/2f1c0a3e-8b1d-4c6f-9a2e-5d7b3c1e9f00' },
    signedAt: NOW,
  };
  const ghostWitness = {
    teamId: 'T',
    witnessUserId: 'captain-1',
    witnessAuthority: 'coCaptain',
    subjectDisplayNameSnapshot: 'Red Shirt',
  };

  it('records the template version signed, and a record naming none is still valid', () => {
    expect(SignedWaiverSchema.safeParse(own).success).toBe(true);
    const { waiverTemplateVersion: _version, ...withoutVersion } = own;
    expect(SignedWaiverSchema.safeParse(withoutVersion).success).toBe(true);
    expect(SignedWaiverSchema.safeParse({ ...own, waiverTemplateVersion: 0 }).success).toBe(false);
  });

  it('keeps the wording signed even when the body is empty', () => {
    expect(SignedWaiverSchema.parse(own).waiverTextSnapshot).toBe('');
  });

  it("carries a ghost's witness, authority, team, and name together or not at all", () => {
    expect(SignedWaiverSchema.safeParse({ ...own, ...ghostWitness }).success).toBe(true);
    const { witnessAuthority: _authority, ...partial } = ghostWitness;
    expect(SignedWaiverSchema.safeParse({ ...own, ...partial }).success).toBe(false);
  });

  it('keeps a V1 witnessed waiver as a legacy witness: team, witness, and the name V1 recorded, nothing guessed', () => {
    const legacyWitness = { teamId: 'T', witnessUserId: 'captain-1', witnessDisplayNameSnapshot: 'Pat Captain' };
    expect(SignedWaiverSchema.safeParse({ ...own, ...legacyWitness }).success).toBe(true);
    const { teamId: _team, ...withoutTeam } = legacyWitness;
    expect(SignedWaiverSchema.safeParse({ ...own, ...withoutTeam }).success).toBe(false);
    expect(SignedWaiverSchema.safeParse({ ...own, witnessDisplayNameSnapshot: 'Pat Captain' }).success).toBe(false);
  });

  it('refuses a witness that mixes the legacy and the full form', () => {
    expect(SignedWaiverSchema.safeParse({ ...own, ...ghostWitness, witnessDisplayNameSnapshot: 'Pat Captain' }).success).toBe(false);
    const mixed = { teamId: 'T', witnessUserId: 'captain-1', witnessDisplayNameSnapshot: 'Pat Captain', witnessAuthority: 'captain' };
    expect(SignedWaiverSchema.safeParse({ ...own, ...mixed }).success).toBe(false);
    expect(
      SignedWaiverSchema.safeParse({ ...own, teamId: 'T', witnessUserId: 'captain-1', witnessDisplayNameSnapshot: 'Pat', subjectDisplayNameSnapshot: 'Red Shirt' }).success,
    ).toBe(false);
  });

  it('records the authority a witness signed under from the four declared', () => {
    expect([...WAIVER_WITNESS_AUTHORITY_KEYS]).toEqual(['captain', 'coCaptain', 'admin', 'referee']);
    expect(SignedWaiverSchema.safeParse({ ...own, ...ghostWitness, witnessAuthority: 'player' }).success).toBe(false);
  });

  it('takes the signature as a staging path, and a ghost only with its team', () => {
    expect(CreateSignedWaiverInputSchema.safeParse({ leagueId: 'L', ...SHOWN, storagePath: STAGING_PATH }).success).toBe(true);
    expect(
      CreateSignedWaiverInputSchema.safeParse({
        leagueId: 'L',
        ...SHOWN,
        storagePath: STAGING_PATH,
        ghost: { ghostUserId: 'ghost_1_a', teamId: 'T' },
      }).success,
    ).toBe(true);
    expect(
      CreateSignedWaiverInputSchema.safeParse({ leagueId: 'L', ...SHOWN, storagePath: STAGING_PATH, ghost: { ghostUserId: 'g' } })
        .success,
    ).toBe(false);
    expect(
      CreateSignedWaiverInputSchema.safeParse({ leagueId: 'L', ...SHOWN, storagePath: STAGING_PATH, signatureUrl: 'https://x' })
        .success,
    ).toBe(false);
  });

  // A signature records the wording its signer saw, so both entries carry the template id and version
  // the dialog displayed.
  it('carries the displayed template id and version on both entries', () => {
    for (const schema of [CreateSignedWaiverInputSchema, AdminCreateSignedWaiverInputSchema]) {
      const ghost = { ghostUserId: 'ghost_1_a', teamId: 'T' };
      expect(schema.safeParse({ leagueId: 'L', ...SHOWN, storagePath: STAGING_PATH, ghost }).success).toBe(true);
      expect(schema.safeParse({ leagueId: 'L', storagePath: STAGING_PATH, ghost }).success).toBe(false);
      expect(schema.safeParse({ leagueId: 'L', ...SHOWN, waiverTemplateVersion: 0, storagePath: STAGING_PATH, ghost }).success).toBe(false);
      expect(schema.safeParse({ leagueId: 'L', ...SHOWN, waiverTemplateVersion: 1.5, storagePath: STAGING_PATH, ghost }).success).toBe(false);
      expect(schema.safeParse({ leagueId: 'L', ...SHOWN, waiverTemplateId: 'a/b', storagePath: STAGING_PATH, ghost }).success).toBe(false);
    }
  });

  it('takes the staging path under the one key every accepting callable shares', () => {
    expect(CreateSignedWaiverInputSchema.safeParse({ leagueId: 'L', ...SHOWN, stagingPath: STAGING_PATH }).success).toBe(false);
    expect(Object.keys(CreateSignedWaiverInputSchema.shape)).toContain('storagePath');
    expect(Object.keys(AdminCreateSignedWaiverInputSchema.shape)).toContain('storagePath');
    expect(Object.keys(AdminStartUploadInputSchema.shape)).toContain('storagePath');
  });

  it("requires the ghost at the admin entry, which signs only a ghost's waiver", () => {
    expect(AdminCreateSignedWaiverInputSchema.safeParse({ leagueId: 'L', ...SHOWN, storagePath: STAGING_PATH }).success).toBe(false);
  });

  it('reads a signature by league and person, a captain naming the team they manage', () => {
    expect(GetSignedWaiverFileInputSchema.safeParse({ leagueId: 'L', userId: 'u1' }).success).toBe(true);
    expect(GetSignedWaiverFileInputSchema.safeParse({ leagueId: 'L', userId: 'u1', teamId: 'T' }).success).toBe(true);
  });
});

describe('the audit and domain vocabulary', () => {
  it('declares the event types the team, ghost, roster, and waiver cores record', () => {
    for (const type of ['leagueTeam.created', 'ghostPlayer.created', 'teamRoster.syncRetried', 'signedWaiver.created']) {
      expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain(type);
    }
  });

  it('declares the domain events a team creation, a ghost add, and a signing name', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'leagueTeam.created', ids: { leagueId: 'L', teamId: 'T' } }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({
        type: 'teamRoster.changed',
        ids: { leagueId: 'L', teamId: 'T', userId: buildGhostUserId(NOW, 'a') },
      }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({ type: 'signedWaiver.created', ids: { leagueId: 'L', userId: 'u1' } }).success,
    ).toBe(true);
  });
});
