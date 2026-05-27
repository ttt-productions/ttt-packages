import { describe, it, expect } from 'vitest';
import {
  GUILD_STANDINGS,
  GUILD_STANDING_IDS,
  WORK_PROJECT_ACTIONS,
  WORK_PROJECT_ACTION_IDS,
  isGuildStandingId,
  isWorkProjectActionId,
  getActionsForGuildStanding,
  canAssignGuildStanding,
  NON_ASSIGNABLE_GUILD_STANDINGS,
  STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS,
  type GuildStandingId,
} from '../src/permissions/index.js';
import { UpdateGuildmateStandingInputSchema } from '../src/schemas/work-project-management.js';

describe('GUILD_STANDING_IDS', () => {
  it('includes "StewardOwner" as the first entry — StewardOwner is in GUILD_STANDING_IDS and NON_ASSIGNABLE_GUILD_STANDINGS', () => {
    expect(GUILD_STANDING_IDS).toContain('StewardOwner' as GuildStandingId);
    expect(GUILD_STANDING_IDS[0]).toBe('StewardOwner');
    expect(NON_ASSIGNABLE_GUILD_STANDINGS).toContain('StewardOwner');
  });

  it('matches the keys of GUILD_STANDINGS exactly', () => {
    expect([...GUILD_STANDING_IDS].sort()).toEqual(Object.keys(GUILD_STANDINGS).sort());
  });

  it('isGuildStandingId returns true for every known role and false for unknown strings', () => {
    for (const id of GUILD_STANDING_IDS) {
      expect(isGuildStandingId(id)).toBe(true);
    }
    expect(isGuildStandingId('StewardOwner')).toBe(true);
    expect(isGuildStandingId('Contributor')).toBe(false);
    expect(isGuildStandingId('Admin')).toBe(false);
    expect(isGuildStandingId('')).toBe(false);
    expect(isGuildStandingId(null)).toBe(false);
    expect(isGuildStandingId(undefined)).toBe(false);
    expect(isGuildStandingId(42)).toBe(false);
  });
});

describe('WORK_PROJECT_ACTIONS', () => {
  it('every action grants at least one role', () => {
    for (const actionId of WORK_PROJECT_ACTION_IDS) {
      const action = WORK_PROJECT_ACTIONS[actionId];
      expect(action.grantedTo.length).toBeGreaterThan(0);
    }
  });

  it('every action only grants known role IDs', () => {
    const knownRoleIds = new Set<string>(GUILD_STANDING_IDS);
    for (const actionId of WORK_PROJECT_ACTION_IDS) {
      const action = WORK_PROJECT_ACTIONS[actionId];
      for (const role of action.grantedTo) {
        expect(knownRoleIds.has(role)).toBe(true);
      }
    }
  });

  it('isWorkProjectActionId returns true for every known action and false for unknown strings', () => {
    for (const id of WORK_PROJECT_ACTION_IDS) {
      expect(isWorkProjectActionId(id)).toBe(true);
    }
    expect(isWorkProjectActionId('not.an.action')).toBe(false);
    expect(isWorkProjectActionId('')).toBe(false);
    expect(isWorkProjectActionId(null)).toBe(false);
    expect(isWorkProjectActionId(undefined)).toBe(false);
    expect(isWorkProjectActionId(42)).toBe(false);
  });

  it('workProject.read is granted to every assignable role', () => {
    expect([...WORK_PROJECT_ACTIONS['workProject.read'].grantedTo].sort()).toEqual(
      [...GUILD_STANDING_IDS].sort(),
    );
  });

  it('getActionsForGuildStanding returns only valid action IDs for each role', () => {
    const knownActionIds = new Set<string>(WORK_PROJECT_ACTION_IDS);
    for (const roleId of GUILD_STANDING_IDS) {
      const actions = getActionsForGuildStanding(roleId);
      for (const action of actions) {
        expect(knownActionIds.has(action)).toBe(true);
      }
    }
  });

  it('getActionsForGuildStanding returns workProject.read for every role', () => {
    for (const roleId of GUILD_STANDING_IDS) {
      expect(getActionsForGuildStanding(roleId)).toContain('workProject.read');
    }
  });
});

describe('canAssignGuildStanding', () => {
  it('rejects "StewardOwner" as target role for everyone — including the workProject stewardOwner', () => {
    expect(
      canAssignGuildStanding({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'StewardOwner',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });

    expect(
      canAssignGuildStanding({
        actorIsOwner: false,
        actorRoles: ['WorkProjectManager'],
        targetRole: 'StewardOwner',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('rejects unknown target roles', () => {
    expect(
      canAssignGuildStanding({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'Contributor',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });

    expect(
      canAssignGuildStanding({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'BogusRole',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('stewardOwner can assign every assignable role', () => {
    const assignableRoles = GUILD_STANDING_IDS.filter(
      (r) => !(NON_ASSIGNABLE_GUILD_STANDINGS as readonly string[]).includes(r),
    );
    for (const roleId of assignableRoles) {
      const result = canAssignGuildStanding({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: roleId,
        action: 'add',
      });
      expect(result.allowed).toBe(true);
    }
  });

  it('stewardOwner can remove every assignable role', () => {
    const assignableRoles = GUILD_STANDING_IDS.filter(
      (r) => !(NON_ASSIGNABLE_GUILD_STANDINGS as readonly string[]).includes(r),
    );
    for (const roleId of assignableRoles) {
      const result = canAssignGuildStanding({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: roleId,
        action: 'remove',
      });
      expect(result.allowed).toBe(true);
    }
  });

  it('non-stewardOwner with no managing role cannot assign anything', () => {
    for (const roleId of GUILD_STANDING_IDS) {
      expect(
        canAssignGuildStanding({
          actorIsOwner: false,
          actorRoles: [],
          targetRole: roleId,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });

      expect(
        canAssignGuildStanding({
          actorIsOwner: false,
          actorRoles: ['WorkAssetViewer'],
          targetRole: roleId,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-stewardOwner WorkProjectManager can assign roles outside STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS', () => {
    for (const roleId of GUILD_STANDING_IDS) {
      const result = canAssignGuildStanding({
        actorIsOwner: false,
        actorRoles: ['WorkProjectManager'],
        targetRole: roleId,
        action: 'add',
      });
      const isOwnerOnly = (STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS as readonly string[]).includes(roleId);
      const isNonAssignable = (NON_ASSIGNABLE_GUILD_STANDINGS as readonly string[]).includes(roleId);
      expect(result.allowed).toBe(!isOwnerOnly && !isNonAssignable);
    }
  });

  it('non-stewardOwner GuildStandingManager can assign roles outside STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS', () => {
    for (const roleId of GUILD_STANDING_IDS) {
      const result = canAssignGuildStanding({
        actorIsOwner: false,
        actorRoles: ['GuildStandingManager'],
        targetRole: roleId,
        action: 'add',
      });
      const isOwnerOnly = (STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS as readonly string[]).includes(roleId);
      const isNonAssignable = (NON_ASSIGNABLE_GUILD_STANDINGS as readonly string[]).includes(roleId);
      expect(result.allowed).toBe(!isOwnerOnly && !isNonAssignable);
    }
  });

  it('non-stewardOwner WorkProjectManager cannot escalate to WorkProjectManager, GuildStandingManager, or StakeShareManager', () => {
    for (const ownerOnlyRole of STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS) {
      expect(
        canAssignGuildStanding({
          actorIsOwner: false,
          actorRoles: ['WorkProjectManager'],
          targetRole: ownerOnlyRole,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-stewardOwner GuildStandingManager cannot escalate to WorkProjectManager, GuildStandingManager, or StakeShareManager', () => {
    for (const ownerOnlyRole of STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS) {
      expect(
        canAssignGuildStanding({
          actorIsOwner: false,
          actorRoles: ['GuildStandingManager'],
          targetRole: ownerOnlyRole,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-stewardOwner cannot edit their own roles even with WorkProjectManager', () => {
    expect(
      canAssignGuildStanding({
        actorIsOwner: false,
        actorRoles: ['WorkProjectManager'],
        targetRole: 'WorkAssetViewer',
        action: 'add',
        actorUid: 'same-uid',
        targetUid: 'same-uid',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('stewardOwner CAN edit their own roles (vacuous but the policy says so)', () => {
    expect(
      canAssignGuildStanding({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'WorkAssetViewer',
        action: 'add',
        actorUid: 'same-uid',
        targetUid: 'same-uid',
      }),
    ).toMatchObject({ allowed: true });
  });

  it('non-stewardOwner WorkProjectManager can edit a DIFFERENT member', () => {
    expect(
      canAssignGuildStanding({
        actorIsOwner: false,
        actorRoles: ['WorkProjectManager'],
        targetRole: 'WorkAssetViewer',
        action: 'add',
        actorUid: 'actor-uid',
        targetUid: 'target-uid',
      }),
    ).toMatchObject({ allowed: true });
  });
});

describe('StewardOwner role invariants', () => {
  it('GUILD_STANDING_IDS[0] is "StewardOwner"', () => {
    expect(GUILD_STANDING_IDS[0]).toBe('StewardOwner');
  });

  it('isGuildStandingId("StewardOwner") returns true', () => {
    expect(isGuildStandingId('StewardOwner')).toBe(true);
  });

  it('every action in WORK_PROJECT_ACTIONS grants "StewardOwner"', () => {
    for (const actionId of WORK_PROJECT_ACTION_IDS) {
      expect(WORK_PROJECT_ACTIONS[actionId].grantedTo).toContain('StewardOwner' as GuildStandingId);
    }
  });

  it('getActionsForGuildStanding("StewardOwner") returns all action ids', () => {
    expect(getActionsForGuildStanding('StewardOwner').length).toBe(WORK_PROJECT_ACTION_IDS.length);
  });
});

describe('UpdateGuildmateStandingInputSchema', () => {
  const validBase = {
    workProjectId: 'workProject-1',
    userId: 'user-1',
    action: 'add' as const,
  };

  it('accepts every known guild standing id', () => {
    for (const roleId of GUILD_STANDING_IDS) {
      const parsed = UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: roleId,
      });
      expect(parsed.guildStanding).toBe(roleId);
    }
  });

  it('accepts "StewardOwner" — StewardOwner is a valid GuildStandingId; assignment is rejected by canAssignGuildStanding, not the schema', () => {
    const parsed = UpdateGuildmateStandingInputSchema.parse({ ...validBase, guildStanding: 'StewardOwner' });
    expect(parsed.guildStanding).toBe('StewardOwner');
  });

  it('rejects unknown roles', () => {
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({ ...validBase, guildStanding: 'Contributor' }),
    ).toThrow();
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({ ...validBase, guildStanding: 'Admin' }),
    ).toThrow();
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({ ...validBase, guildStanding: 'BogusRole' }),
    ).toThrow();
  });

  it('accepts both "add" and "remove" actions', () => {
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

  it('rejects unknown actions', () => {
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: 'WorkAssetViewer',
        action: 'toggle',
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({ workProjectId: 'p', userId: 'u', guildStanding: 'WorkAssetViewer' }),
    ).toThrow();
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({ userId: 'u', guildStanding: 'WorkAssetViewer', action: 'add' }),
    ).toThrow();
  });

  it('is strict — rejects extra fields', () => {
    expect(() =>
      UpdateGuildmateStandingInputSchema.parse({
        ...validBase,
        guildStanding: 'WorkAssetViewer',
        extra: 'nope',
      }),
    ).toThrow();
  });
});



