import { describe, it, expect } from 'vitest';
import {
  DEFAULT_Q_SPORTS_CLAIMS,
  RETIRED_SYSTEM_ROLE_CLAIM_KEYS,
  SYSTEM_ROLE_CLAIM_KEYS,
  USER_STATUS_CLAIM_KEY,
  parseQSportsClaims,
} from '../src/types/claims.js';
import { SYSTEM_ROLE_KEYS, USER_STATUS_KEYS } from '../src/types/unions.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import {
  EMAIL_MAX_LENGTH,
  MAX_ADMIN_LIST_CHANGES,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
} from '../src/constants/business.js';
import { PASSWORD_POLICY } from '../src/constants/account-policy.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { toPath } from '../src/paths/utils.js';
import { toReservedDisplayNameKey } from '../src/utils/display-name.js';
import { isActiveAccount } from '../src/utils/account-status.js';
import { AuditEventSchema } from '../src/doc-schemas/audit-event.js';
import { ReservedDisplayNameSchema } from '../src/doc-schemas/reserved-display-name.js';
import { UserPrivateDataSchema, UserProfileSchema } from '../src/doc-schemas/user-profile.js';
import { DomainEventSchema } from '../src/domain-events/domain-events.js';
import { StatusReconcileQueueEntrySchema } from '../src/doc-schemas/status-reconcile-queue.js';
import {
  ADMIN_STANDING_BAN_REFUSAL_REASON,
  AdminUpdateUserProfileStatusInputSchema,
  AdminUpdateUserProfileStatusResultSchema,
  GetDisplayNameAvailabilityInputSchema,
  GetDisplayNameAvailabilityResultSchema,
  detectUserSearchKind,
  CreateUserProfileInputSchema,
  CreateUserProfileResultSchema,
  AdminUpdateAdminListInputSchema,
  AdminUpdateUserProfileDisplayNameInputSchema,
} from '../src/schemas/users.js';

const NOW = 1_760_000_000_000;

describe('custom-claim contract', () => {
  it('declares exactly the two global roles and the two account statuses', () => {
    expect([...SYSTEM_ROLE_KEYS]).toEqual(['admin', 'referee']);
    expect([...USER_STATUS_KEYS]).toEqual(['active', 'banned']);
  });

  it('holds a role only on an exact true', () => {
    expect(parseQSportsClaims({ isAdmin: true, isReferee: true })).toEqual({
      isAdmin: true,
      isReferee: true,
      userStatus: 'active',
    });
    expect(parseQSportsClaims({ isAdmin: 'true', isReferee: 1 })).toEqual(DEFAULT_Q_SPORTS_CLAIMS);
    expect(parseQSportsClaims({})).toEqual(DEFAULT_Q_SPORTS_CLAIMS);
  });

  it("grants nothing from V1's retired admin or referee claim name", () => {
    expect(parseQSportsClaims({ admin: true, referee: true })).toEqual(DEFAULT_Q_SPORTS_CLAIMS);
  });

  it('reads a banned status claim and treats anything else as active', () => {
    expect(parseQSportsClaims({ status: 'banned' }).userStatus).toBe('banned');
    expect(parseQSportsClaims({ status: 'suspended' }).userStatus).toBe('active');
    expect(parseQSportsClaims({ userStatus: 'banned' }).userStatus).toBe('active');
  });

  it('keeps the live claim names apart from the retired ones the re-stamp removes', () => {
    const live = new Set<string>(Object.values(SYSTEM_ROLE_CLAIM_KEYS));
    for (const retired of Object.values(RETIRED_SYSTEM_ROLE_CLAIM_KEYS)) {
      expect(live.has(retired)).toBe(false);
    }
    expect(live.has(USER_STATUS_CLAIM_KEY)).toBe(false);
  });
});

describe('display-name reservation key', () => {
  it('is case- and edge-whitespace-insensitive', () => {
    expect(toReservedDisplayNameKey('  Jane Doe ')).toBe(toReservedDisplayNameKey('jane doe'));
    expect(toReservedDisplayNameKey('JANE DOE')).toBe(toReservedDisplayNameKey('jane doe'));
  });

  it('never yields a path separator, so the key is always one document id', () => {
    const key = toReservedDisplayNameKey('AC/DC Fan');
    expect(key).not.toContain('/');
    expect(toPath(PATH_BUILDERS.reservedDisplayName('AC/DC Fan')).split('/')).toHaveLength(2);
  });

  it('never yields an id Firestore reserves or cannot address', () => {
    for (const name of ['__a__', '__init__', '...', 'a..b']) {
      const key = toReservedDisplayNameKey(name);
      expect(key).not.toMatch(/^__.*__$/);
      expect(key).not.toBe('.');
      expect(key).not.toBe('..');
    }
  });

  it('keeps distinct names distinct', () => {
    expect(toReservedDisplayNameKey('Jane Doe')).not.toBe(toReservedDisplayNameKey('JaneDoe'));
  });

  it('binds a reservation document', () => {
    const doc = { userId: 'u1', displayName: 'Jane Doe', reservedAt: NOW };
    expect(ReservedDisplayNameSchema.safeParse(doc).success).toBe(true);
    expect(ReservedDisplayNameSchema.safeParse({ ...doc, reservedAt: '2024-01-01' }).success).toBe(
      false,
    );
  });
});

describe('user profile account status', () => {
  const profile = {
    displayName: 'Jane Doe',
    displayName_lowercase: 'jane doe',
    userStatus: 'active',
    createdAt: NOW,
    updatedAt: NOW,
  };

  it('keeps email and contact details off the publicly readable profile', () => {
    expect(Object.keys(UserProfileSchema.shape)).not.toContain('email');
    expect(Object.keys(UserProfileSchema.shape)).not.toContain('defaultContactPhone');
    expect(
      UserPrivateDataSchema.safeParse({ email: 'jane@example.com', updatedAt: NOW }).success,
    ).toBe(true);
    expect(toPath(PATH_BUILDERS.userPrivateData('u1'))).toBe('userProfiles/u1/privateData/u1');
  });

  it('requires a declared status', () => {
    expect(UserProfileSchema.safeParse(profile).success).toBe(true);
    expect(UserProfileSchema.safeParse({ ...profile, userStatus: 'banned' }).success).toBe(true);
    expect(UserProfileSchema.safeParse({ ...profile, userStatus: 'suspended' }).success).toBe(
      false,
    );
    const { userStatus: _omitted, ...withoutStatus } = profile;
    expect(UserProfileSchema.safeParse(withoutStatus).success).toBe(false);
  });
});

describe('callable input schemas', () => {
  const registration = {
    displayName: 'Jane Doe',
    email: 'jane@example.com',
    password: 'correct horse',
    acceptedTerms: true,
  };

  it('createUserProfile takes a bounded name, an email, a password, and a checked terms box, and nothing else', () => {
    expect(CreateUserProfileInputSchema.safeParse(registration).success).toBe(true);
    expect(
      CreateUserProfileInputSchema.safeParse({ ...registration, acceptedTerms: false }).success,
    ).toBe(false);
    for (const missing of ['displayName', 'email', 'password', 'acceptedTerms'] as const) {
      const { [missing]: _omitted, ...without } = registration;
      expect(CreateUserProfileInputSchema.safeParse(without).success, missing).toBe(false);
    }
    expect(
      CreateUserProfileInputSchema.safeParse({
        ...registration,
        displayName: 'x'.repeat(MIN_DISPLAY_NAME_LENGTH - 1),
      }).success,
    ).toBe(false);
    expect(
      CreateUserProfileInputSchema.safeParse({
        ...registration,
        displayName: 'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      CreateUserProfileInputSchema.safeParse({ ...registration, userId: 'someoneElse' }).success,
    ).toBe(false);
  });

  it('createUserProfile holds the password to the product policy at both bounds', () => {
    const at = (length: number) =>
      CreateUserProfileInputSchema.safeParse({ ...registration, password: 'p'.repeat(length) })
        .success;
    expect(at(PASSWORD_POLICY.minLength)).toBe(true);
    expect(at(PASSWORD_POLICY.maxLength)).toBe(true);
    expect(at(PASSWORD_POLICY.minLength - 1)).toBe(false);
    expect(at(PASSWORD_POLICY.maxLength + 1)).toBe(false);
  });

  it('createUserProfile refuses an address that is not an email, or one past the email ceiling', () => {
    expect(
      CreateUserProfileInputSchema.safeParse({ ...registration, email: 'not-an-email' }).success,
    ).toBe(false);
    const emailOfLength = (length: number) => {
      const fixed = `${'a'.repeat(64)}@${Array(4).fill('b'.repeat(50)).join('.')}.`;
      return `${fixed}${'c'.repeat(length - fixed.length - 4)}.com`;
    };
    expect(emailOfLength(EMAIL_MAX_LENGTH)).toHaveLength(EMAIL_MAX_LENGTH);
    expect(
      CreateUserProfileInputSchema.safeParse({
        ...registration,
        email: emailOfLength(EMAIL_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      CreateUserProfileInputSchema.safeParse({
        ...registration,
        email: emailOfLength(EMAIL_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('createUserProfile trims the name before bounding it', () => {
    const parsed = CreateUserProfileInputSchema.parse({
      ...registration,
      displayName: '  Jane Doe  ',
    });
    expect(parsed.displayName).toBe('Jane Doe');
    expect(
      CreateUserProfileInputSchema.safeParse({ ...registration, displayName: '  ab  ' }).success,
    ).toBe(false);
  });

  it('createUserProfile answers the new account uid, and nothing else', () => {
    expect(CreateUserProfileResultSchema.safeParse({ userId: 'u1' }).success).toBe(true);
    expect(
      CreateUserProfileResultSchema.safeParse({ userId: 'u1', status: 'registrationExpired' })
        .success,
    ).toBe(false);
    expect(CreateUserProfileResultSchema.safeParse({}).success).toBe(false);
  });

  it('getDisplayNameAvailability takes the same name rule createUserProfile takes, and nothing else', () => {
    expect(GetDisplayNameAvailabilityInputSchema.parse({ displayName: '  Jane Doe  ' })).toEqual({
      displayName: 'Jane Doe',
    });
    for (const displayName of [
      'x'.repeat(MIN_DISPLAY_NAME_LENGTH - 1),
      'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
    ]) {
      expect(GetDisplayNameAvailabilityInputSchema.safeParse({ displayName }).success).toBe(false);
      expect(CreateUserProfileInputSchema.safeParse({ ...registration, displayName }).success).toBe(
        false,
      );
    }
    expect(
      GetDisplayNameAvailabilityInputSchema.safeParse({ displayName: 'Jane Doe', userId: 'u1' })
        .success,
    ).toBe(false);
  });

  it('getDisplayNameAvailability answers available, or unavailable because the name is taken', () => {
    expect(GetDisplayNameAvailabilityResultSchema.safeParse({ available: true }).success).toBe(
      true,
    );
    expect(
      GetDisplayNameAvailabilityResultSchema.safeParse({ available: false, reason: 'taken' })
        .success,
    ).toBe(true);
    expect(
      GetDisplayNameAvailabilityResultSchema.safeParse({ available: false, reason: 'disallowed' })
        .success,
    ).toBe(false);
  });

  it('adminUpdateAdminList takes four named uid lists, bounded, and rejects a discriminator payload', () => {
    expect(AdminUpdateAdminListInputSchema.safeParse({ addReferees: ['u1'] }).success).toBe(true);
    expect(AdminUpdateAdminListInputSchema.safeParse({}).success).toBe(true);
    expect(
      AdminUpdateAdminListInputSchema.safeParse({ role: 'referee', action: 'add', userId: 'u1' })
        .success,
    ).toBe(false);
    expect(AdminUpdateAdminListInputSchema.safeParse({ addAdmins: [''] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_ADMIN_LIST_CHANGES + 1 }, (_, i) => `u${i}`);
    expect(AdminUpdateAdminListInputSchema.safeParse({ addAdmins: tooMany }).success).toBe(false);
  });

  it('adminUpdateUserProfileDisplayName is strict', () => {
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'New Name',
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'New Name',
        displayName_lowercase: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('the private record after registration', () => {
  it('drops a registration-start or deletion-claim field a document still holds', () => {
    const parsed = UserPrivateDataSchema.parse({
      email: 'jane@example.com',
      updatedAt: NOW,
      registrationStartedAt: NOW,
      orphanDeletionClaimedAt: NOW,
    });
    expect(parsed).toEqual({ email: 'jane@example.com', updatedAt: NOW });
  });
});

describe('the rename refuses what the form refuses', () => {
  it('trims the new name and refuses a line break, a blank name, and one outside the length limits', () => {
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.parse({
        userId: 'u1',
        newDisplayName: '  New Name  ',
      }).newDisplayName,
    ).toBe('New Name');
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'New\nName',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: '   ',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'a'.repeat(MIN_DISPLAY_NAME_LENGTH - 1),
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserProfileDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});

describe('the ban and unban contract', () => {
  it('takes the account, the status, and an internal reason — and nothing else', () => {
    expect(
      AdminUpdateUserProfileStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'banned',
        reason: 'Repeated abuse',
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateUserProfileStatusInputSchema.safeParse({ userId: 'u1', userStatus: 'banned' })
        .success,
    ).toBe(false);
    expect(
      AdminUpdateUserProfileStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'banned',
        reason: '  ',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserProfileStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'suspended',
        reason: 'Repeated abuse',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserProfileStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'banned',
        reason: 'Repeated abuse',
        actorUid: 'admin-1',
      }).success,
    ).toBe(false);
  });

  it('answers whether the status moved, and nothing about the sign-in half', () => {
    const answer = { userId: 'u1', userStatus: 'banned', previousStatus: 'active', changed: true };
    expect(AdminUpdateUserProfileStatusResultSchema.safeParse(answer).success).toBe(true);
    expect(
      AdminUpdateUserProfileStatusResultSchema.safeParse({ ...answer, accessSync: 'pending' })
        .success,
    ).toBe(false);
  });

  it('names the admin-standing refusal so a client can tell it from a fault', () => {
    expect(ADMIN_STANDING_BAN_REFUSAL_REASON).toBe('adminStandingTarget');
  });
});

describe('the status reconcile queue entry', () => {
  const statusEntry = {
    enqueuedAt: NOW,
    attemptCount: 0,
    authEffect: 'accountStatus',
    targetStatus: 'banned',
    reason: 'statusChangePending',
    writeId: 'w1',
  };
  const roleClaimsEntry = {
    enqueuedAt: NOW,
    attemptCount: 0,
    authEffect: 'roleClaims',
    reason: 'postCommitAuthEffectFailed',
  };
  const without = (entry: Record<string, unknown>, field: string) =>
    Object.fromEntries(Object.entries(entry).filter(([key]) => key !== field));

  it('accepts a status entry and a role-claims entry, each with or without its last attempt', () => {
    expect(StatusReconcileQueueEntrySchema.safeParse(statusEntry).success).toBe(true);
    expect(
      StatusReconcileQueueEntrySchema.safeParse({
        ...statusEntry,
        attemptCount: 2,
        lastAttemptAt: NOW,
      }).success,
    ).toBe(true);
    expect(StatusReconcileQueueEntrySchema.safeParse(roleClaimsEntry).success).toBe(true);
    expect(
      StatusReconcileQueueEntrySchema.safeParse({ ...roleClaimsEntry, lastAttemptAt: NOW }).success,
    ).toBe(true);
  });

  it('pins each entry to its own reason and constrains the target status', () => {
    expect(
      StatusReconcileQueueEntrySchema.safeParse({
        ...statusEntry,
        reason: 'postCommitAuthEffectFailed',
      }).success,
    ).toBe(false);
    expect(
      StatusReconcileQueueEntrySchema.safeParse({
        ...roleClaimsEntry,
        reason: 'statusChangePending',
      }).success,
    ).toBe(false);
    expect(
      StatusReconcileQueueEntrySchema.safeParse({ ...statusEntry, targetStatus: 'suspended' })
        .success,
    ).toBe(false);
  });

  it('a status entry requires the writeId that fences its removal, and its target status', () => {
    expect(StatusReconcileQueueEntrySchema.safeParse(without(statusEntry, 'writeId')).success).toBe(
      false,
    );
    expect(
      StatusReconcileQueueEntrySchema.safeParse(without(statusEntry, 'targetStatus')).success,
    ).toBe(false);
  });

  it('a role-claims entry carries no status, and every entry names a known effect', () => {
    expect(
      StatusReconcileQueueEntrySchema.parse({ ...roleClaimsEntry, targetStatus: 'banned' }),
    ).not.toHaveProperty('targetStatus');
    expect(
      StatusReconcileQueueEntrySchema.safeParse({ ...roleClaimsEntry, authEffect: 'docsAccepted' })
        .success,
    ).toBe(false);
    expect(
      StatusReconcileQueueEntrySchema.safeParse(without(statusEntry, 'authEffect')).success,
    ).toBe(false);
  });

  it('keeps no revision, applied state, backoff, or failure message', () => {
    for (const field of [
      { statusRevision: 1 },
      { syncState: 'pending' },
      { nextAttemptAt: NOW },
      { lastFailureMessage: 'x' },
    ]) {
      expect(StatusReconcileQueueEntrySchema.parse({ ...statusEntry, ...field })).toEqual(
        statusEntry,
      );
    }
  });
});

describe('audit event document', () => {
  const event = {
    id: 'a1',
    type: 'adminList.roleGranted',
    schemaVersion: 1,
    actor: { uid: 'admin1', isAdmin: true, actorMode: 'adminReview', systemRole: 'admin' },
    target: { uid: 'u1', ref: '_systemData/adminList' },
    timestamp: NOW,
    ip: null,
    userAgent: null,
    region: 'us-east1',
    metadata: { role: 'referee' },
    result: 'success',
    failureReason: null,
    correlationId: null,
  };

  it('accepts every actor mode, the admin modes with the role they acted with', () => {
    expect(AuditEventSchema.safeParse(event).success).toBe(true);
    for (const actorMode of ['adminReview', 'adminOverride'] as const) {
      for (const systemRole of ['admin', 'referee'] as const) {
        expect(
          AuditEventSchema.safeParse({
            ...event,
            actor: { uid: 'a1', isAdmin: false, actorMode, systemRole },
          }).success,
        ).toBe(true);
      }
    }
    for (const actorMode of ['user', 'teammateUser'] as const) {
      expect(
        AuditEventSchema.safeParse({ ...event, actor: { uid: 'u1', isAdmin: true, actorMode } })
          .success,
      ).toBe(true);
    }
    expect(
      AuditEventSchema.safeParse({
        ...event,
        actor: { uid: null, isAdmin: false, actorMode: 'system' },
      }).success,
    ).toBe(true);
  });

  it('rejects an admin mode with no role, a mode outside the five, and a free-form type', () => {
    expect(
      AuditEventSchema.safeParse({
        ...event,
        actor: { uid: 'a', isAdmin: true, actorMode: 'adminOverride' },
      }).success,
    ).toBe(false);
    expect(
      AuditEventSchema.safeParse({
        ...event,
        actor: { uid: 'a', isAdmin: true, actorMode: 'systemRole', systemRole: 'admin' },
      }).success,
    ).toBe(false);
    expect(
      AuditEventSchema.safeParse({ ...event, actor: { uid: 'a', actorMode: 'user' } }).success,
      'the claim metadata is recorded on every actor',
    ).toBe(false);
    expect(AuditEventSchema.safeParse({ ...event, type: 'something.happened' }).success).toBe(
      false,
    );
  });

  it('reads no role on a non-admin mode, and no field an actor does not carry', () => {
    for (const actorMode of ['user', 'teammateUser', 'system']) {
      expect(
        AuditEventSchema.parse({
          ...event,
          actor: { uid: 'a', isAdmin: true, actorMode, systemRole: 'admin' },
        }).actor,
        actorMode,
      ).toEqual({ uid: 'a', isAdmin: true, actorMode });
    }
    expect(
      AuditEventSchema.parse({
        ...event,
        actor: {
          uid: 'a',
          isAdmin: true,
          actorMode: 'adminReview',
          systemRole: 'admin',
          origin: {},
        },
      }).actor,
    ).toEqual({ uid: 'a', isAdmin: true, actorMode: 'adminReview', systemRole: 'admin' });
  });

  it('records a rejected attempt with an unauthenticated actor', () => {
    expect(
      AuditEventSchema.safeParse({
        ...event,
        actor: { uid: null, isAdmin: false, actorMode: 'user' },
        target: null,
        result: 'failure',
        failureReason: 'unauthenticated',
      }).success,
    ).toBe(true);
  });

  const AUDIT_EVENT_TYPE_NAME = /^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/;

  it('names every event type in two lower-camelCase parts, the thing first and the past-tense action last', () => {
    for (const type of AUDIT_EVENT_TYPE_KEYS) expect(type).toMatch(AUDIT_EVENT_TYPE_NAME);
    expect(new Set(AUDIT_EVENT_TYPE_KEYS).size).toBe(AUDIT_EVENT_TYPE_KEYS.length);
  });

  it('the naming check accepts a thing and its action and refuses every other spelling', () => {
    for (const name of [
      'landingPage.updated',
      'sportLeague.statusChanged',
      'adminList.roleGranted',
    ]) {
      expect(name).toMatch(AUDIT_EVENT_TYPE_NAME);
    }
    for (const name of [
      'LandingPage.updated',
      'landing_page.updated',
      'landing-page.updated',
      'landingPage.Updated',
      'landingPage.2updated',
      'landingPage',
      'landingPage.',
      'landingPage..updated',
      'leagueTeam.roster.synced',
    ]) {
      expect(name).not.toMatch(AUDIT_EVENT_TYPE_NAME);
    }
  });
});

describe('domain events', () => {
  it('carries the account events, each with exactly its own ids', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'userProfile.registered', ids: { userId: 'u1' } })
        .success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({ type: 'adminList.changed', ids: { userId: 'u1' } }).success,
    ).toBe(false);
    expect(DomainEventSchema.safeParse({ type: 'adminList.updated', ids: {} }).success).toBe(true);
    expect(DomainEventSchema.parse({ type: 'adminList.updated', ids: { userId: 'u1' } })).toEqual({
      type: 'adminList.updated',
      ids: {},
    });
    expect(
      DomainEventSchema.safeParse({ type: 'userProfile.displayNameChanged', ids: { userId: 'u1' } })
        .success,
    ).toBe(true);
    expect(
      DomainEventSchema.parse({ type: 'userProfile.registered', ids: { userId: 'u1', extra: 1 } }),
    ).toEqual({ type: 'userProfile.registered', ids: { userId: 'u1' } });
  });
});

describe('whether an account may act as a member', () => {
  it('admits only a registered profile whose status is exactly active', () => {
    expect(isActiveAccount({ userStatus: 'active' })).toBe(true);
    expect(isActiveAccount({ userStatus: 'banned' })).toBe(false);
  });

  it('refuses an account whose profile does not exist yet, or is not known', () => {
    expect(isActiveAccount(null)).toBe(false);
    expect(isActiveAccount(undefined)).toBe(false);
  });

  it('fails closed on a status outside the declared set', () => {
    expect(isActiveAccount({ userStatus: 'suspended' })).toBe(false);
  });
});

describe('the kind of an admin account search', () => {
  const UID = 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4';

  it('reads a full email, surrounding spaces and all, as an email', () => {
    expect(detectUserSearchKind('ada@example.com')).toBe('email');
    expect(detectUserSearchKind('  ada@example.com  ')).toBe('email');
  });

  it('reads exactly 28 letters and digits as a uid', () => {
    expect(UID).toHaveLength(28);
    expect(detectUserSearchKind(UID)).toBe('uid');
  });

  it('reads anything else as a name', () => {
    expect(detectUserSearchKind('Ada Lovelace')).toBe('name');
    expect(detectUserSearchKind('ada@')).toBe('name');
    expect(detectUserSearchKind(UID.slice(1))).toBe('name');
    expect(detectUserSearchKind(`${UID}a`)).toBe('name');
    expect(detectUserSearchKind('ghost_abc')).toBe('name');
    expect(detectUserSearchKind('')).toBe('name');
  });
});
