import { describe, it, expect } from 'vitest';
import {
  GUILD_STANDINGS,
  GUILD_STANDING_IDS,
  GUILD_STANDING_VALUES,
  WORK_PROJECT_ACTIONS,
  WORK_PROJECT_ACTION_IDS,
  isGuildStandingId,
  isGuildStandingValue,
  isWorkProjectActionId,
  getActionsForGuildStanding,
  getGuildStandingValueFromId,
  canAssignGuildStanding,
  NON_ASSIGNABLE_GUILD_STANDINGS,
  STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS,
  type GuildStandingId,
} from '../src/permissions/index.js';
import { UpdateGuildmateStandingInputSchema } from '../src/schemas/work-project-management.js';

describe('Guild standing identifiers', () => {
  it('includes StewardOwner as the first code identifier', () => {
    expect(GUILD_STANDING_IDS).toContain('StewardOwner' as GuildStandingId);
    expect(GUILD_STANDING_IDS[0]).toBe('StewardOwner');
    expect(NON_ASSIGNABLE_GUILD_STANDINGS).toContain('StewardOwner');
  });

  it('matches the keys of GUILD_STANDINGS exactly', () => {
    expect([...GUILD_STANDING_IDS].sort()).toEqual(Object.keys(GUILD_STANDINGS).sort());
  });

  it('isGuildStandingId returns true for known code identifiers', () => {
    for (const guildStandingId of GUILD_STANDING_IDS) {
      expect(isGuildStandingId(guildStandingId)).toBe(true);
    }
    expect(isGuildStandingId('Contributor')).toBe(false);
  });
});

describe('Guild standing stored values', () => {
  it('includes stored Steward value for StewardOwner', () => {
    expect(GUILD_STANDING_VALUES).toContain('Steward');
    expect(isGuildStandingValue('Steward')).toBe(true);
    expect(isGuildStandingValue('StewardOwner')).toBe(false);
  });

  it('contains no duplicates', () => {
    expect(new Set(GUILD_STANDING_VALUES).size).toBe(GUILD_STANDING_VALUES.length);
  });
});

describe('WORK_PROJECT_ACTIONS', () => {
  it('every action grants at least one guild standing identifier', () => {
    for (const actionId of WORK_PROJECT_ACTION_IDS) {
      const action = WORK_PROJECT_ACTIONS[actionId];
      expect(action.grantedTo.length).toBeGreaterThan(0);
    }
  });

  it('every action only grants known guild standing identifiers', () => {
    const knownGuildStandingIds = new Set<string>(GUILD_STANDING_IDS);
    for (const actionId of WORK_PROJECT_ACTION_IDS) {
      const action = WORK_PROJECT_ACTIONS[actionId];
      for (const guildStandingId of action.grantedTo) {
        expect(knownGuildStandingIds.has(guildStandingId)).toBe(true);
      }
    }
  });

  it('isWorkProjectActionId returns true for every known action', () => {
    for (const id of WORK_PROJECT_ACTION_IDS) {
      expect(isWorkProjectActionId(id)).toBe(true);
    }
    expect(isWorkProjectActionId('not.an.action')).toBe(false);
  });

  it('workProject.read is granted to every guild standing identifier', () => {
    expect([...WORK_PROJECT_ACTIONS['workProject.read'].grantedTo].sort()).toEqual(
      [...GUILD_STANDING_IDS].sort(),
    );
  });

  it('getActionsForGuildStanding returns only valid action IDs', () => {
    const knownActionIds = new Set<string>(WORK_PROJECT_ACTION_IDS);
    for (const guildStandingId of GUILD_STANDING_IDS) {
      const actionIds = getActionsForGuildStanding(guildStandingId);
      for (const actionId of actionIds) {
        expect(knownActionIds.has(actionId)).toBe(true);
      }
    }
  });
});

describe('canAssignGuildStanding', () => {
  it('rejects Steward for everyone', () => {
    expect(
      canAssignGuildStanding({
        actorIsStewardOwner: true,
        actorGuildStandings: [],
        targetGuildStanding: 'Steward',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });

    expect(
      canAssignGuildStanding({
        actorIsStewardOwner: false,
        actorGuildStandings: ['WorkProjectManager'],
        targetGuildStanding: 'Steward',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('rejects unknown target guild standings', () => {
    expect(
      canAssignGuildStanding({
        actorIsStewardOwner: true,
        actorGuildStandings: [],
        targetGuildStanding: 'Contributor',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('stewardOwner can assign and remove every assignable guild standing', () => {
    const assignableGuildStandingValues = GUILD_STANDING_VALUES.filter(
      (guildStandingValue) => guildStandingValue !== 'Steward',
    );

    for (const targetGuildStanding of assignableGuildStandingValues) {
      expect(
        canAssignGuildStanding({
          actorIsStewardOwner: true,
          actorGuildStandings: [],
          targetGuildStanding,
          action: 'add',
        }).allowed,
      ).toBe(true);

      expect(
        canAssignGuildStanding({
          actorIsStewardOwner: true,
          actorGuildStandings: [],
          targetGuildStanding,
          action: 'remove',
        }).allowed,
      ).toBe(true);
    }
  });

  it('non-stewardOwner without manager standing cannot assign', () => {
    for (const targetGuildStanding of GUILD_STANDING_VALUES) {
      expect(
        canAssignGuildStanding({
          actorIsStewardOwner: false,
          actorGuildStandings: [],
          targetGuildStanding,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-stewardOwner WorkProjectManager can assign non-steward-only, assignable guild standings', () => {
    const stewardOnlyGuildStandingValues = new Set(
      STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS.map((guildStandingId) => getGuildStandingValueFromId(guildStandingId)),
    );

    for (const targetGuildStanding of GUILD_STANDING_VALUES) {
      const result = canAssignGuildStanding({
        actorIsStewardOwner: false,
        actorGuildStandings: ['WorkProjectManager'],
        targetGuildStanding,
        action: 'add',
      });
      const isSteward = targetGuildStanding === 'Steward';
      const isStewardOnly = stewardOnlyGuildStandingValues.has(targetGuildStanding);
      expect(result.allowed).toBe(!isSteward && !isStewardOnly);
    }
  });

  it('non-stewardOwner cannot edit their own guild standings', () => {
    expect(
      canAssignGuildStanding({
        actorIsStewardOwner: false,
        actorGuildStandings: ['WorkProjectManager'],
        targetGuildStanding: 'WorkAssetViewer',
        action: 'add',
        actorUid: 'same-uid',
        targetUid: 'same-uid',
      }),
    ).toMatchObject({ allowed: false });
  });
});

describe('StewardOwner identifier invariants', () => {
  it('every action grants StewardOwner identifier', () => {
    for (const actionId of WORK_PROJECT_ACTION_IDS) {
      expect(WORK_PROJECT_ACTIONS[actionId].grantedTo).toContain('StewardOwner' as GuildStandingId);
    }
  });

  it('getActionsForGuildStanding returns all actions for StewardOwner identifier', () => {
    expect(getActionsForGuildStanding('StewardOwner').length).toBe(WORK_PROJECT_ACTION_IDS.length);
  });
});

describe('UpdateGuildmateStandingInputSchema', () => {
  const validBase = {
    workProjectId: 'workProject-1',
    userId: 'user-1',
    action: 'add' as const,
  };

  it('accepts every known stored guild standing value', () => {
    for (const guildStandingValue of GUILD_STANDING_VALUES) {
      const parsed = UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: guildStandingValue,
      });
      expect(parsed.guildStanding).toBe(guildStandingValue);
    }
  });

  it('rejects StewardOwner as wire value', () => {
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({ ...validBase, guildStanding: 'StewardOwner' }),
    ).toThrow();
  });

  it('accepts add and remove actions', () => {
    expect(
      UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: 'WorkAssetViewer',
        action: 'add',
      }).action,
    ).toBe('add');
    expect(
      UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: 'WorkAssetViewer',
        action: 'remove',
      }).action,
    ).toBe('remove');
  });

  it('is strict and rejects unknown fields', () => {
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: 'WorkAssetViewer',
        extra: 'nope',
      }),
    ).toThrow();
  });
});
