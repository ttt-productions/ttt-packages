// The league's contracts: the stored document, the callable inputs and results, the lifecycle, and
// the one team-type union. Each test pins a property the league core or its callers rely on.

import { describe, it, expect } from 'vitest';
import {
  MAX_LEAGUE_DESCRIPTION_LENGTH,
  MAX_LEAGUE_TITLE_LENGTH,
  MAX_PLAYOFF_CUTOFF,
  MIN_LEAGUE_DESCRIPTION_LENGTH,
  MIN_LEAGUE_TITLE_LENGTH,
} from '../src/constants/business.js';
import { LeagueTeamSchema } from '../src/doc-schemas/league-team.js';
import { SportLeagueSchema } from '../src/doc-schemas/sport-league.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import {
  AdminCreateSportLeagueInputSchema,
  AdminUpdateSportLeagueInputSchema,
  AdminUpdateSportLeagueResultSchema,
  AdminUpdateSportLeagueStatusInputSchema,
  AdminUpdateSportLeagueStatusResultSchema,
  LEAGUE_SETTINGS_FIELD_KEYS,
  SwitchLeagueModeInputSchema,
  SwitchLeagueModeResultSchema,
} from '../src/schemas/leagues.js';
import { SPORT_ADAPTER_LIST } from '../src/sports/registry.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import { LEAGUE_TYPE_KEYS } from '../src/types/sports.js';
import {
  CLOSED_LEAGUE_STATUS,
  LEAGUE_MODE_KEYS,
  LEAGUE_STATUS_KEYS,
  LEAGUE_STATUS_ON_CREATE,
  LEAGUE_STATUS_TRANSITIONS,
  OPEN_LEAGUE_STATUS_KEYS,
  TEAM_TYPED_LEAGUE_MODE,
  TEAM_TYPE_KEYS,
  TEAM_TYPE_ON_MODE_SWITCH,
} from '../src/types/unions.js';
import type { LeagueStatus } from '../src/types/unions.js';

const NOW = 1712345678901;

const settings = {
  leagueTitle: 'Spring Rec',
  description: 'Tuesday night basketball at the rec centre.',
  leagueStartDate: '2026-03-01',
  leagueEndDate: '2026-05-30',
  playoffCutoff: 4,
  playoffCutoffComp: 2,
  playoffCutoffRec: 2,
  requiresWaiver: false,
};

const storedLeague = {
  ...settings,
  leagueType: LEAGUE_TYPE_KEYS[0],
  leagueMode: TEAM_TYPED_LEAGUE_MODE,
  status: LEAGUE_STATUS_ON_CREATE,
  createdAt: NOW,
  updatedAt: NOW,
};

const createInput = {
  ...settings,
  leagueType: LEAGUE_TYPE_KEYS[0],
  leagueMode: TEAM_TYPED_LEAGUE_MODE,
};
const updateInput = { leagueId: 'L1', expectedUpdatedAt: NOW, ...settings };

describe('the stored league', () => {
  it('accepts a league with no waiver and one with its waiver template', () => {
    expect(SportLeagueSchema.safeParse(storedLeague).success).toBe(true);
    expect(
      SportLeagueSchema.safeParse({ ...storedLeague, requiresWaiver: true, waiverTemplateId: 'w1' })
        .success,
    ).toBe(true);
  });

  it('refuses a waiver requirement with no template, and a template with no requirement', () => {
    expect(SportLeagueSchema.safeParse({ ...storedLeague, requiresWaiver: true }).success).toBe(
      false,
    );
    expect(SportLeagueSchema.safeParse({ ...storedLeague, waiverTemplateId: 'w1' }).success).toBe(
      false,
    );
  });

  it('reads a league with no team or game created yet, and one whose creations advanced its revisions', () => {
    expect(SportLeagueSchema.safeParse(storedLeague).success).toBe(true);
    expect(
      SportLeagueSchema.safeParse({ ...storedLeague, teamRevision: 3, gameRevision: 12 }).success,
    ).toBe(true);
  });

  it('holds its team and game revisions as counts', () => {
    for (const field of ['teamRevision', 'gameRevision'] as const) {
      expect(SportLeagueSchema.safeParse({ ...storedLeague, [field]: -1 }).success).toBe(false);
      expect(SportLeagueSchema.safeParse({ ...storedLeague, [field]: 1.5 }).success).toBe(false);
    }
  });

  it('refuses the empty-string "no waiver" sentinel', () => {
    expect(SportLeagueSchema.safeParse({ ...storedLeague, waiverTemplateId: '' }).success).toBe(
      false,
    );
    expect(
      SportLeagueSchema.safeParse({ ...storedLeague, requiresWaiver: true, waiverTemplateId: '' })
        .success,
    ).toBe(false);
  });

  it('refuses an end date before the start date, and a date that does not exist', () => {
    expect(
      SportLeagueSchema.safeParse({ ...storedLeague, leagueEndDate: '2026-02-28' }).success,
    ).toBe(false);
    expect(
      SportLeagueSchema.safeParse({ ...storedLeague, leagueEndDate: '2026-02-31' }).success,
    ).toBe(false);
  });

  it('declares none of the denormalized or retired league fields', () => {
    const fields = Object.keys(SportLeagueSchema.shape);
    for (const retired of [
      'teams',
      'gameSchedule',
      'freeAgents',
      'imageHint',
      'imageUrl',
      'images',
      'playerStats',
      'waiverId',
    ]) {
      expect(fields).not.toContain(retired);
    }
  });

  it('holds every setting the settings edit writes', () => {
    const fields = Object.keys(SportLeagueSchema.shape);
    for (const setting of LEAGUE_SETTINGS_FIELD_KEYS) expect(fields).toContain(setting);
  });
});

describe('creating a league', () => {
  it('accepts a complete league of every declared sport', () => {
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, leagueType }).success,
      ).toBe(true);
    }
  });

  it('offers every sport in the adapter registry, football included', () => {
    const offered = SPORT_ADAPTER_LIST.map((adapter) => adapter.leagueType);
    expect(offered).toContain('Football');
    for (const leagueType of offered) {
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, leagueType }).success,
      ).toBe(true);
    }
  });

  it('refuses a sport outside the union, in any casing', () => {
    for (const leagueType of ['Hockey', 'basketball', '', null]) {
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, leagueType }).success,
      ).toBe(false);
    }
  });

  it('refuses an unknown field, the status included — every league starts pending', () => {
    expect(
      AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, status: 'active' }).success,
    ).toBe(false);
    expect(AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, teams: [] }).success).toBe(
      false,
    );
  });

  it('bounds the title and description by the declared limits', () => {
    const title = (length: number) => ({ ...createInput, leagueTitle: 'x'.repeat(length) });
    const description = (length: number) => ({ ...createInput, description: 'x'.repeat(length) });
    expect(
      AdminCreateSportLeagueInputSchema.safeParse(title(MIN_LEAGUE_TITLE_LENGTH - 1)).success,
    ).toBe(false);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse(title(MIN_LEAGUE_TITLE_LENGTH)).success,
    ).toBe(true);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse(title(MAX_LEAGUE_TITLE_LENGTH)).success,
    ).toBe(true);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse(title(MAX_LEAGUE_TITLE_LENGTH + 1)).success,
    ).toBe(false);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse(description(MIN_LEAGUE_DESCRIPTION_LENGTH - 1))
        .success,
    ).toBe(false);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse(description(MAX_LEAGUE_DESCRIPTION_LENGTH + 1))
        .success,
    ).toBe(false);
  });

  it('counts the title after trimming, so padding cannot satisfy the minimum', () => {
    const padded = {
      ...createInput,
      leagueTitle: `  ${'x'.repeat(MIN_LEAGUE_TITLE_LENGTH - 1)}  `,
    };
    expect(AdminCreateSportLeagueInputSchema.safeParse(padded).success).toBe(false);
  });

  it('requires every playoff cutoff as a whole number from zero to the cap', () => {
    for (const field of ['playoffCutoff', 'playoffCutoffComp', 'playoffCutoffRec'] as const) {
      const { [field]: _omitted, ...missing } = createInput;
      expect(AdminCreateSportLeagueInputSchema.safeParse(missing).success).toBe(false);
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, [field]: -1 }).success,
      ).toBe(false);
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, [field]: 2.5 }).success,
      ).toBe(false);
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({
          ...createInput,
          [field]: MAX_PLAYOFF_CUTOFF + 1,
        }).success,
      ).toBe(false);
      expect(
        AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, [field]: 0 }).success,
      ).toBe(true);
    }
  });

  it('requires a template exactly when a waiver is required', () => {
    expect(
      AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, requiresWaiver: true }).success,
    ).toBe(false);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, waiverTemplateId: 'w1' })
        .success,
    ).toBe(false);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse({
        ...createInput,
        requiresWaiver: true,
        waiverTemplateId: 'w1',
      }).success,
    ).toBe(true);
  });

  it('accepts a start date already past, and refuses an end before the start', () => {
    expect(
      AdminCreateSportLeagueInputSchema.safeParse({
        ...createInput,
        leagueStartDate: '2020-01-01',
        leagueEndDate: '2020-03-01',
      }).success,
    ).toBe(true);
    expect(
      AdminCreateSportLeagueInputSchema.safeParse({ ...createInput, leagueEndDate: '2026-02-01' })
        .success,
    ).toBe(false);
  });
});

describe('editing a league', () => {
  it('accepts the whole settings set', () => {
    expect(AdminUpdateSportLeagueInputSchema.safeParse(updateInput).success).toBe(true);
  });

  it('refuses the sport, the mode, the status, and the gallery summary — each has its own owner', () => {
    for (const extra of [
      { leagueType: LEAGUE_TYPE_KEYS[0] },
      { leagueMode: TEAM_TYPED_LEAGUE_MODE },
      { status: CLOSED_LEAGUE_STATUS },
      { pictures: { count: 0, updatedAt: NOW } },
    ]) {
      expect(
        AdminUpdateSportLeagueInputSchema.safeParse({ ...updateInput, ...extra }).success,
      ).toBe(false);
    }
  });

  it('turns a waiver requirement on after creation, with its template', () => {
    expect(
      AdminUpdateSportLeagueInputSchema.safeParse({
        ...updateInput,
        requiresWaiver: true,
        waiverTemplateId: 'w1',
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateSportLeagueInputSchema.safeParse({ ...updateInput, requiresWaiver: true }).success,
    ).toBe(false);
  });

  it('refuses a partial settings set', () => {
    const { leagueTitle: _omitted, ...partial } = updateInput;
    expect(AdminUpdateSportLeagueInputSchema.safeParse(partial).success).toBe(false);
  });

  it('requires the updatedAt the form was loaded at, as an epoch-millisecond number', () => {
    const { expectedUpdatedAt: _omitted, ...unconditional } = updateInput;
    expect(AdminUpdateSportLeagueInputSchema.safeParse(unconditional).success).toBe(false);
    for (const expectedUpdatedAt of [-1, 1.5, '1712345678901', null]) {
      expect(
        AdminUpdateSportLeagueInputSchema.safeParse({ ...updateInput, expectedUpdatedAt }).success,
      ).toBe(false);
    }
  });
});

describe('the status move and the mode switch', () => {
  it('take a league and a declared value, and nothing else', () => {
    expect(
      AdminUpdateSportLeagueStatusInputSchema.safeParse({
        leagueId: 'L1',
        status: CLOSED_LEAGUE_STATUS,
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateSportLeagueStatusInputSchema.safeParse({ leagueId: 'L1', status: 'archived' })
        .success,
    ).toBe(false);
    expect(
      SwitchLeagueModeInputSchema.safeParse({ leagueId: 'L1', newMode: TEAM_TYPED_LEAGUE_MODE })
        .success,
    ).toBe(true);
    expect(
      SwitchLeagueModeInputSchema.safeParse({ leagueId: 'L1', newMode: 'Mixed' }).success,
    ).toBe(false);
    expect(
      SwitchLeagueModeInputSchema.safeParse({
        leagueId: 'L1',
        newMode: TEAM_TYPED_LEAGUE_MODE,
        teamType: 'Competitive',
      }).success,
    ).toBe(false);
  });
});

describe('the league callable results', () => {
  const statusResult = {
    leagueId: 'L1',
    status: CLOSED_LEAGUE_STATUS,
    previousUpdatedAt: NOW,
    updatedAt: NOW + 1,
  };
  const modeResult = {
    leagueId: 'L1',
    leagueMode: TEAM_TYPED_LEAGUE_MODE,
    teamsUpdated: 3,
    previousUpdatedAt: NOW,
    updatedAt: NOW + 1,
  };

  it('answers a settings save with the league updatedAt the next save from the same form sends', () => {
    const result = { leagueId: 'L1', changedFields: ['leagueTitle'], updatedAt: NOW };
    expect(AdminUpdateSportLeagueResultSchema.safeParse(result).success).toBe(true);
    const { updatedAt: _omitted, ...withoutUpdatedAt } = result;
    expect(AdminUpdateSportLeagueResultSchema.safeParse(withoutUpdatedAt).success).toBe(false);
    for (const updatedAt of [-1, 1.5, String(NOW), null]) {
      expect(AdminUpdateSportLeagueResultSchema.safeParse({ ...result, updatedAt }).success).toBe(
        false,
      );
    }
  });

  it('answers a status move and a mode switch with the league updatedAt before and after', () => {
    expect(AdminUpdateSportLeagueStatusResultSchema.safeParse(statusResult).success).toBe(true);
    expect(SwitchLeagueModeResultSchema.safeParse(modeResult).success).toBe(true);
    for (const field of ['previousUpdatedAt', 'updatedAt'] as const) {
      const { [field]: _statusOmitted, ...statusMissing } = statusResult;
      const { [field]: _modeOmitted, ...modeMissing } = modeResult;
      expect(AdminUpdateSportLeagueStatusResultSchema.safeParse(statusMissing).success).toBe(false);
      expect(SwitchLeagueModeResultSchema.safeParse(modeMissing).success).toBe(false);
      expect(
        AdminUpdateSportLeagueStatusResultSchema.safeParse({ ...statusResult, [field]: 1.5 })
          .success,
      ).toBe(false);
      expect(SwitchLeagueModeResultSchema.safeParse({ ...modeResult, [field]: -1 }).success).toBe(
        false,
      );
    }
  });

  it('counts the teams a mode switch retyped as a whole number from zero', () => {
    expect(SwitchLeagueModeResultSchema.safeParse({ ...modeResult, teamsUpdated: 0 }).success).toBe(
      true,
    );
    for (const teamsUpdated of [-1, 2.5, '3']) {
      expect(SwitchLeagueModeResultSchema.safeParse({ ...modeResult, teamsUpdated }).success).toBe(
        false,
      );
    }
  });
});

describe('the league lifecycle', () => {
  it('names a move list for every status, and never a move to the same status', () => {
    for (const status of LEAGUE_STATUS_KEYS) {
      expect(LEAGUE_STATUS_TRANSITIONS[status]).toBeDefined();
      expect(LEAGUE_STATUS_TRANSITIONS[status]).not.toContain(status);
    }
  });

  it('moves only forward, and a closed league moves nowhere', () => {
    for (const from of LEAGUE_STATUS_KEYS) {
      for (const to of LEAGUE_STATUS_TRANSITIONS[from]) {
        expect(LEAGUE_STATUS_KEYS.indexOf(to)).toBeGreaterThan(LEAGUE_STATUS_KEYS.indexOf(from));
      }
    }
    expect(LEAGUE_STATUS_TRANSITIONS[CLOSED_LEAGUE_STATUS]).toEqual([]);
  });

  it('counts every status but closed as open, and only statuses with a move ahead of them', () => {
    expect([...OPEN_LEAGUE_STATUS_KEYS, CLOSED_LEAGUE_STATUS].sort()).toEqual(
      [...LEAGUE_STATUS_KEYS].sort(),
    );
    expect(OPEN_LEAGUE_STATUS_KEYS).not.toContain(CLOSED_LEAGUE_STATUS);
    for (const status of LEAGUE_STATUS_KEYS) {
      expect((OPEN_LEAGUE_STATUS_KEYS as readonly string[]).includes(status)).toBe(
        LEAGUE_STATUS_TRANSITIONS[status].length > 0,
      );
    }
  });

  it('reaches every status from the one a league is created in', () => {
    const reached = new Set<LeagueStatus>([LEAGUE_STATUS_ON_CREATE]);
    let frontier: LeagueStatus[] = [LEAGUE_STATUS_ON_CREATE];
    while (frontier.length > 0) {
      frontier = frontier.flatMap((status) =>
        LEAGUE_STATUS_TRANSITIONS[status].filter((next) => !reached.has(next)),
      );
      for (const status of frontier) reached.add(status);
    }
    expect([...reached].sort()).toEqual([...LEAGUE_STATUS_KEYS].sort());
  });
});

describe('the one team-type union', () => {
  it('has exactly the two pool types — no third "Regular" member', () => {
    expect([...TEAM_TYPE_KEYS].sort()).toEqual(['Competitive', 'Recreational']);
  });

  it('represents "no type" one way: the field is absent, never null or a stray member', () => {
    const team = {
      name: 'Hoopers',
      icon: 'Shield',
      leagueId: 'L1',
      createdByUserId: 'u1',
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(LeagueTeamSchema.safeParse(team).success).toBe(true);
    expect(
      LeagueTeamSchema.safeParse({ ...team, teamType: TEAM_TYPE_ON_MODE_SWITCH }).success,
    ).toBe(true);
    expect(LeagueTeamSchema.safeParse({ ...team, teamType: null }).success).toBe(false);
    expect(LeagueTeamSchema.safeParse({ ...team, teamType: 'Regular' }).success).toBe(false);
  });

  it('names a typed mode and a switch-in type from their own unions', () => {
    expect(LEAGUE_MODE_KEYS).toContain(TEAM_TYPED_LEAGUE_MODE);
    expect(TEAM_TYPE_KEYS).toContain(TEAM_TYPE_ON_MODE_SWITCH);
  });
});

describe('league audit and domain events', () => {
  it('declares an audit event type for every league transition', () => {
    for (const type of [
      'league.created',
      'league.updated',
      'league.statusChanged',
      'league.modeSwitched',
    ]) {
      expect(AUDIT_EVENT_TYPE_KEYS).toContain(type);
    }
  });

  it('names a mode switch by its league alone', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'league.modeSwitched', ids: { leagueId: 'L1' } }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({
        type: 'league.modeSwitched',
        ids: { leagueId: 'L1', teamId: 'T1' },
      }).success,
    ).toBe(false);
  });
});
