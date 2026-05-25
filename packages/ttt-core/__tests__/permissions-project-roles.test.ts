import { describe, it, expect } from 'vitest';
import {
  PROJECT_ROLES,
  PROJECT_ROLE_IDS,
  PROJECT_ACTIONS,
  PROJECT_ACTION_IDS,
  isProjectRoleId,
  isProjectActionId,
  getActionsForProjectRole,
  canAssignProjectRole,
  NON_ASSIGNABLE_PROJECT_ROLES,
  OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES,
  type ProjectRoleId,
} from '../src/permissions/index.js';
import { UpdateProjectMemberRoleInputSchema } from '../src/schemas/project-management.js';

describe('PROJECT_ROLE_IDS', () => {
  it('includes "Owner" as the first entry — Owner is in PROJECT_ROLE_IDS and NON_ASSIGNABLE_PROJECT_ROLES', () => {
    expect(PROJECT_ROLE_IDS).toContain('Owner' as ProjectRoleId);
    expect(PROJECT_ROLE_IDS[0]).toBe('Owner');
    expect(NON_ASSIGNABLE_PROJECT_ROLES).toContain('Owner');
  });

  it('matches the keys of PROJECT_ROLES exactly', () => {
    expect([...PROJECT_ROLE_IDS].sort()).toEqual(Object.keys(PROJECT_ROLES).sort());
  });

  it('isProjectRoleId returns true for every known role and false for unknown strings', () => {
    for (const id of PROJECT_ROLE_IDS) {
      expect(isProjectRoleId(id)).toBe(true);
    }
    expect(isProjectRoleId('Owner')).toBe(true);
    expect(isProjectRoleId('Contributor')).toBe(false);
    expect(isProjectRoleId('Admin')).toBe(false);
    expect(isProjectRoleId('')).toBe(false);
    expect(isProjectRoleId(null)).toBe(false);
    expect(isProjectRoleId(undefined)).toBe(false);
    expect(isProjectRoleId(42)).toBe(false);
  });
});

describe('PROJECT_ACTIONS', () => {
  it('every action grants at least one role', () => {
    for (const actionId of PROJECT_ACTION_IDS) {
      const action = PROJECT_ACTIONS[actionId];
      expect(action.grantedTo.length).toBeGreaterThan(0);
    }
  });

  it('every action only grants known role IDs', () => {
    const knownRoleIds = new Set<string>(PROJECT_ROLE_IDS);
    for (const actionId of PROJECT_ACTION_IDS) {
      const action = PROJECT_ACTIONS[actionId];
      for (const role of action.grantedTo) {
        expect(knownRoleIds.has(role)).toBe(true);
      }
    }
  });

  it('isProjectActionId returns true for every known action and false for unknown strings', () => {
    for (const id of PROJECT_ACTION_IDS) {
      expect(isProjectActionId(id)).toBe(true);
    }
    expect(isProjectActionId('not.an.action')).toBe(false);
    expect(isProjectActionId('')).toBe(false);
    expect(isProjectActionId(null)).toBe(false);
    expect(isProjectActionId(undefined)).toBe(false);
    expect(isProjectActionId(42)).toBe(false);
  });

  it('project.read is granted to every assignable role', () => {
    expect([...PROJECT_ACTIONS['project.read'].grantedTo].sort()).toEqual(
      [...PROJECT_ROLE_IDS].sort(),
    );
  });

  it('getActionsForProjectRole returns only valid action IDs for each role', () => {
    const knownActionIds = new Set<string>(PROJECT_ACTION_IDS);
    for (const roleId of PROJECT_ROLE_IDS) {
      const actions = getActionsForProjectRole(roleId);
      for (const action of actions) {
        expect(knownActionIds.has(action)).toBe(true);
      }
    }
  });

  it('getActionsForProjectRole returns project.read for every role', () => {
    for (const roleId of PROJECT_ROLE_IDS) {
      expect(getActionsForProjectRole(roleId)).toContain('project.read');
    }
  });
});

describe('canAssignProjectRole', () => {
  it('rejects "Owner" as target role for everyone — including the project owner', () => {
    expect(
      canAssignProjectRole({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'Owner',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });

    expect(
      canAssignProjectRole({
        actorIsOwner: false,
        actorRoles: ['ProjectManager'],
        targetRole: 'Owner',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('rejects unknown target roles', () => {
    expect(
      canAssignProjectRole({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'Contributor',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });

    expect(
      canAssignProjectRole({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'BogusRole',
        action: 'add',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('owner can assign every assignable role', () => {
    const assignableRoles = PROJECT_ROLE_IDS.filter(
      (r) => !(NON_ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(r),
    );
    for (const roleId of assignableRoles) {
      const result = canAssignProjectRole({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: roleId,
        action: 'add',
      });
      expect(result.allowed).toBe(true);
    }
  });

  it('owner can remove every assignable role', () => {
    const assignableRoles = PROJECT_ROLE_IDS.filter(
      (r) => !(NON_ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(r),
    );
    for (const roleId of assignableRoles) {
      const result = canAssignProjectRole({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: roleId,
        action: 'remove',
      });
      expect(result.allowed).toBe(true);
    }
  });

  it('non-owner with no managing role cannot assign anything', () => {
    for (const roleId of PROJECT_ROLE_IDS) {
      expect(
        canAssignProjectRole({
          actorIsOwner: false,
          actorRoles: [],
          targetRole: roleId,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });

      expect(
        canAssignProjectRole({
          actorIsOwner: false,
          actorRoles: ['FileViewer'],
          targetRole: roleId,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-owner ProjectManager can assign roles outside OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES', () => {
    for (const roleId of PROJECT_ROLE_IDS) {
      const result = canAssignProjectRole({
        actorIsOwner: false,
        actorRoles: ['ProjectManager'],
        targetRole: roleId,
        action: 'add',
      });
      const isOwnerOnly = (OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(roleId);
      const isNonAssignable = (NON_ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(roleId);
      expect(result.allowed).toBe(!isOwnerOnly && !isNonAssignable);
    }
  });

  it('non-owner RoleManager can assign roles outside OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES', () => {
    for (const roleId of PROJECT_ROLE_IDS) {
      const result = canAssignProjectRole({
        actorIsOwner: false,
        actorRoles: ['RoleManager'],
        targetRole: roleId,
        action: 'add',
      });
      const isOwnerOnly = (OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(roleId);
      const isNonAssignable = (NON_ASSIGNABLE_PROJECT_ROLES as readonly string[]).includes(roleId);
      expect(result.allowed).toBe(!isOwnerOnly && !isNonAssignable);
    }
  });

  it('non-owner ProjectManager cannot escalate to ProjectManager, RoleManager, or ShareManager', () => {
    for (const ownerOnlyRole of OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES) {
      expect(
        canAssignProjectRole({
          actorIsOwner: false,
          actorRoles: ['ProjectManager'],
          targetRole: ownerOnlyRole,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-owner RoleManager cannot escalate to ProjectManager, RoleManager, or ShareManager', () => {
    for (const ownerOnlyRole of OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES) {
      expect(
        canAssignProjectRole({
          actorIsOwner: false,
          actorRoles: ['RoleManager'],
          targetRole: ownerOnlyRole,
          action: 'add',
        }),
      ).toMatchObject({ allowed: false });
    }
  });

  it('non-owner cannot edit their own roles even with ProjectManager', () => {
    expect(
      canAssignProjectRole({
        actorIsOwner: false,
        actorRoles: ['ProjectManager'],
        targetRole: 'FileViewer',
        action: 'add',
        actorUid: 'same-uid',
        targetUid: 'same-uid',
      }),
    ).toMatchObject({ allowed: false });
  });

  it('owner CAN edit their own roles (vacuous but the policy says so)', () => {
    expect(
      canAssignProjectRole({
        actorIsOwner: true,
        actorRoles: [],
        targetRole: 'FileViewer',
        action: 'add',
        actorUid: 'same-uid',
        targetUid: 'same-uid',
      }),
    ).toMatchObject({ allowed: true });
  });

  it('non-owner ProjectManager can edit a DIFFERENT member', () => {
    expect(
      canAssignProjectRole({
        actorIsOwner: false,
        actorRoles: ['ProjectManager'],
        targetRole: 'FileViewer',
        action: 'add',
        actorUid: 'actor-uid',
        targetUid: 'target-uid',
      }),
    ).toMatchObject({ allowed: true });
  });
});

describe('Owner role invariants', () => {
  it('PROJECT_ROLE_IDS[0] is "Owner"', () => {
    expect(PROJECT_ROLE_IDS[0]).toBe('Owner');
  });

  it('isProjectRoleId("Owner") returns true', () => {
    expect(isProjectRoleId('Owner')).toBe(true);
  });

  it('every action in PROJECT_ACTIONS grants "Owner"', () => {
    for (const actionId of PROJECT_ACTION_IDS) {
      expect(PROJECT_ACTIONS[actionId].grantedTo).toContain('Owner' as ProjectRoleId);
    }
  });

  it('getActionsForProjectRole("Owner") returns all action ids', () => {
    expect(getActionsForProjectRole('Owner').length).toBe(PROJECT_ACTION_IDS.length);
  });
});

describe('UpdateProjectMemberRoleInputSchema', () => {
  const validBase = {
    projectId: 'project-1',
    userId: 'user-1',
    action: 'add' as const,
  };

  it('accepts every known PROJECT_ROLE_ID', () => {
    for (const roleId of PROJECT_ROLE_IDS) {
      const parsed = UpdateProjectMemberRoleInputSchema.parse({
        ...validBase,
        role: roleId,
      });
      expect(parsed.role).toBe(roleId);
    }
  });

  it('accepts "Owner" — Owner is a valid ProjectRoleId; assignment is rejected by canAssignProjectRole, not the schema', () => {
    const parsed = UpdateProjectMemberRoleInputSchema.parse({ ...validBase, role: 'Owner' });
    expect(parsed.role).toBe('Owner');
  });

  it('rejects unknown roles', () => {
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({ ...validBase, role: 'Contributor' }),
    ).toThrow();
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({ ...validBase, role: 'Admin' }),
    ).toThrow();
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({ ...validBase, role: 'BogusRole' }),
    ).toThrow();
  });

  it('accepts both "add" and "remove" actions', () => {
    expect(
      UpdateProjectMemberRoleInputSchema.parse({
        ...validBase,
        role: 'FileViewer',
        action: 'add',
      }).action,
    ).toBe('add');
    expect(
      UpdateProjectMemberRoleInputSchema.parse({
        ...validBase,
        role: 'FileViewer',
        action: 'remove',
      }).action,
    ).toBe('remove');
  });

  it('rejects unknown actions', () => {
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({
        ...validBase,
        role: 'FileViewer',
        action: 'toggle',
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({ projectId: 'p', userId: 'u', role: 'FileViewer' }),
    ).toThrow();
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({ userId: 'u', role: 'FileViewer', action: 'add' }),
    ).toThrow();
  });

  it('is strict — rejects extra fields', () => {
    expect(() =>
      UpdateProjectMemberRoleInputSchema.parse({
        ...validBase,
        role: 'FileViewer',
        extra: 'nope',
      }),
    ).toThrow();
  });
});
