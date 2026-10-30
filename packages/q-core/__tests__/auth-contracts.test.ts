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
  MAX_ADMIN_LIST_CHANGES,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
} from '../src/constants/business.js';
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
  AdminUpdateUserStatusInputSchema,
  AdminUpdateUserStatusResultSchema,
  CheckDisplayNameAvailableInputSchema,
  CheckDisplayNameAvailableResultSchema,
  CreateRegistrationStartResultSchema,
  detectUserSearchKind,
  RegisterUserInputSchema,
  RegisterUserResultSchema,
  UpdateAdminListInputSchema,
  UpdateDisplayNameInputSchema,
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
  it('registerUser takes a bounded name and a checked terms box, and nothing else', () => {
    expect(
      RegisterUserInputSchema.safeParse({ displayName: 'Jane Doe', acceptedTerms: true }).success,
    ).toBe(true);
    expect(
      RegisterUserInputSchema.safeParse({ displayName: 'Jane Doe', acceptedTerms: false }).success,
    ).toBe(false);
    expect(RegisterUserInputSchema.safeParse({ displayName: 'Jane Doe' }).success).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({
        displayName: 'x'.repeat(MIN_DISPLAY_NAME_LENGTH - 1),
        acceptedTerms: true,
      }).success,
    ).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({
        displayName: 'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
        acceptedTerms: true,
      }).success,
    ).toBe(false);
    // A client-supplied identity or email is an unknown key, not an override (RULE-STD-ARCH-106).
    expect(
      RegisterUserInputSchema.safeParse({
        displayName: 'Jane Doe',
        acceptedTerms: true,
        userId: 'someoneElse',
      }).success,
    ).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({
        displayName: 'Jane Doe',
        acceptedTerms: true,
        email: 'a@b.c',
      }).success,
    ).toBe(false);
  });

  it('registerUser trims the name before bounding it', () => {
    const parsed = RegisterUserInputSchema.parse({
      displayName: '  Jane Doe  ',
      acceptedTerms: true,
    });
    expect(parsed.displayName).toBe('Jane Doe');
    expect(
      RegisterUserInputSchema.safeParse({ displayName: '  ab  ', acceptedTerms: true }).success,
    ).toBe(false);
  });

  it('checkDisplayNameAvailable takes the same name rule registerUser takes, and nothing else', () => {
    expect(CheckDisplayNameAvailableInputSchema.parse({ displayName: '  Jane Doe  ' })).toEqual({
      displayName: 'Jane Doe',
    });
    for (const displayName of [
      'x'.repeat(MIN_DISPLAY_NAME_LENGTH - 1),
      'x'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
    ]) {
      expect(CheckDisplayNameAvailableInputSchema.safeParse({ displayName }).success).toBe(false);
      expect(RegisterUserInputSchema.safeParse({ displayName, acceptedTerms: true }).success).toBe(
        false,
      );
    }
    expect(
      CheckDisplayNameAvailableInputSchema.safeParse({ displayName: 'Jane Doe', userId: 'u1' })
        .success,
    ).toBe(false);
  });

  it('checkDisplayNameAvailable answers available, or unavailable because the name is taken', () => {
    expect(CheckDisplayNameAvailableResultSchema.safeParse({ available: true }).success).toBe(true);
    expect(
      CheckDisplayNameAvailableResultSchema.safeParse({ available: false, reason: 'taken' })
        .success,
    ).toBe(true);
    expect(
      CheckDisplayNameAvailableResultSchema.safeParse({ available: false, reason: 'disallowed' })
        .success,
    ).toBe(false);
  });

  it('updateAdminList takes four named uid lists, bounded, and rejects a discriminator payload', () => {
    expect(UpdateAdminListInputSchema.safeParse({ addReferees: ['u1'] }).success).toBe(true);
    expect(UpdateAdminListInputSchema.safeParse({}).success).toBe(true);
    expect(
      UpdateAdminListInputSchema.safeParse({ role: 'referee', action: 'add', userId: 'u1' })
        .success,
    ).toBe(false);
    expect(UpdateAdminListInputSchema.safeParse({ addAdmins: [''] }).success).toBe(false);
    const tooMany = Array.from({ length: MAX_ADMIN_LIST_CHANGES + 1 }, (_, i) => `u${i}`);
    expect(UpdateAdminListInputSchema.safeParse({ addAdmins: tooMany }).success).toBe(false);
  });

  it('updateDisplayName is strict', () => {
    expect(
      UpdateDisplayNameInputSchema.safeParse({ userId: 'u1', newDisplayName: 'New Name' }).success,
    ).toBe(true);
    expect(
      UpdateDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'New Name',
        displayName_lowercase: 'x',
      }).success,
    ).toBe(false);
  });
});

describe("the orphan cleanup's deletion claim", () => {
  const privateData = { email: 'jane@example.com', updatedAt: NOW };

  it('the private record stores the epoch-ms moment the cleanup claimed the uid, and is unclaimed without it', () => {
    expect(
      UserPrivateDataSchema.parse({ ...privateData, orphanDeletionClaimedAt: NOW })
        .orphanDeletionClaimedAt,
    ).toBe(NOW);
    expect(UserPrivateDataSchema.parse(privateData).orphanDeletionClaimedAt).toBeUndefined();
  });

  it('refuses a claim that is not a whole non-negative epoch-ms value', () => {
    expect(
      UserPrivateDataSchema.safeParse({ ...privateData, orphanDeletionClaimedAt: -1 }).success,
    ).toBe(false);
    expect(
      UserPrivateDataSchema.safeParse({ ...privateData, orphanDeletionClaimedAt: 1.5 }).success,
    ).toBe(false);
  });

  it('starting a registration on a claimed login answers registrationExpired', () => {
    expect(
      CreateRegistrationStartResultSchema.safeParse({ outcome: 'registrationExpired' }).success,
    ).toBe(true);
    expect(CreateRegistrationStartResultSchema.safeParse({ outcome: 'started' }).success).toBe(
      true,
    );
  });

  it('registering on a claimed login answers registrationExpired, carrying no account', () => {
    expect(RegisterUserResultSchema.safeParse({ status: 'registrationExpired' }).success).toBe(
      true,
    );
    expect(
      RegisterUserResultSchema.safeParse({ status: 'registrationExpired', userId: 'u1' }).success,
    ).toBe(false);
    expect(
      RegisterUserResultSchema.safeParse({
        status: 'registered',
        userId: 'u1',
        displayName: 'Jane Doe',
      }).success,
    ).toBe(true);
    expect(
      RegisterUserResultSchema.safeParse({ userId: 'u1', displayName: 'Jane Doe' }).success,
    ).toBe(false);
  });
});

describe('the rename refuses what the form refuses', () => {
  it('trims the new name and refuses a line break, a blank name, and one outside the length limits', () => {
    expect(
      UpdateDisplayNameInputSchema.parse({ userId: 'u1', newDisplayName: '  New Name  ' })
        .newDisplayName,
    ).toBe('New Name');
    expect(
      UpdateDisplayNameInputSchema.safeParse({ userId: 'u1', newDisplayName: 'New\nName' }).success,
    ).toBe(false);
    expect(
      UpdateDisplayNameInputSchema.safeParse({ userId: 'u1', newDisplayName: '   ' }).success,
    ).toBe(false);
    expect(
      UpdateDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'a'.repeat(MIN_DISPLAY_NAME_LENGTH - 1),
      }).success,
    ).toBe(false);
    expect(
      UpdateDisplayNameInputSchema.safeParse({
        userId: 'u1',
        newDisplayName: 'a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});

describe('the ban and unban contract', () => {
  it('takes the account, the status, and an internal reason — and nothing else', () => {
    expect(
      AdminUpdateUserStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'banned',
        reason: 'Repeated abuse',
      }).success,
    ).toBe(true);
    expect(
      AdminUpdateUserStatusInputSchema.safeParse({ userId: 'u1', userStatus: 'banned' }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'banned',
        reason: '  ',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'suspended',
        reason: 'Repeated abuse',
      }).success,
    ).toBe(false);
    expect(
      AdminUpdateUserStatusInputSchema.safeParse({
        userId: 'u1',
        userStatus: 'banned',
        reason: 'Repeated abuse',
        actorUid: 'admin-1',
      }).success,
    ).toBe(false);
  });

  it('answers whether the status moved, and nothing about the sign-in half', () => {
    const answer = { userId: 'u1', userStatus: 'banned', previousStatus: 'active', changed: true };
    expect(AdminUpdateUserStatusResultSchema.safeParse(answer).success).toBe(true);
    expect(
      AdminUpdateUserStatusResultSchema.safeParse({ ...answer, accessSync: 'pending' }).success,
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
      StatusReconcileQueueEntrySchema.safeParse({ ...roleClaimsEntry, targetStatus: 'banned' })
        .success,
    ).toBe(false);
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
      expect(StatusReconcileQueueEntrySchema.safeParse({ ...statusEntry, ...field }).success).toBe(
        false,
      );
    }
  });
});

describe('audit event document', () => {
  const event = {
    id: 'a1',
    type: 'admin.systemRoleGranted',
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
    for (const actorMode of ['user', 'teamManager'] as const) {
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

  it('rejects a role on a non-admin mode, and any field an actor does not carry', () => {
    for (const actorMode of ['user', 'teamManager', 'system']) {
      expect(
        AuditEventSchema.safeParse({
          ...event,
          actor: { uid: 'a', isAdmin: true, actorMode, systemRole: 'admin' },
        }).success,
        actorMode,
      ).toBe(false);
    }
    expect(
      AuditEventSchema.safeParse({
        ...event,
        actor: {
          uid: 'a',
          isAdmin: true,
          actorMode: 'adminReview',
          systemRole: 'admin',
          origin: {},
        },
      }).success,
    ).toBe(false);
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

  // ttt-core's audit event grammar: two or more dot-separated lower-camelCase segments, each opening
  // with a letter and free to carry digits after it. The first names what was acted on
  // (`landingPage`, `waiverTemplate`), the last the action, and a middle one a sub-record where the
  // action needs it (`leagueTeam.roster.synced`).
  const AUDIT_EVENT_TYPE_NAME = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;

  it('names every event type in dot-separated lower-camelCase segments, domain first and action last', () => {
    for (const type of AUDIT_EVENT_TYPE_KEYS) expect(type).toMatch(AUDIT_EVENT_TYPE_NAME);
    expect(new Set(AUDIT_EVENT_TYPE_KEYS).size).toBe(AUDIT_EVENT_TYPE_KEYS.length);
  });

  it('the naming check accepts every shape ttt-core names an event in and refuses every other spelling', () => {
    for (const name of [
      'landingPage.updated',
      'league.statusChanged',
      'admin.systemRoleGranted',
      'leagueTeam.roster.synced',
      'user.accountClosedUnder13',
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
    ]) {
      expect(name).not.toMatch(AUDIT_EVENT_TYPE_NAME);
    }
  });
});

describe('domain events', () => {
  it('carries the account events, each with exactly its own ids', () => {
    expect(
      DomainEventSchema.safeParse({ type: 'user.registered', ids: { userId: 'u1' } }).success,
    ).toBe(true);
    // The role rosters are a live subscription, so a role change has no event to refresh them.
    expect(
      DomainEventSchema.safeParse({ type: 'adminList.changed', ids: { userId: 'u1' } }).success,
    ).toBe(false);
    expect(
      DomainEventSchema.safeParse({ type: 'displayName.changed', ids: { userId: 'u1' } }).success,
    ).toBe(true);
    expect(
      DomainEventSchema.safeParse({ type: 'user.registered', ids: { userId: 'u1', extra: 1 } })
        .success,
    ).toBe(false);
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
