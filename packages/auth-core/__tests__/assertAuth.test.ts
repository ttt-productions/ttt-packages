import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createAssertAuth } from '../src/server/assertAuth.js';
import { AuthAssertionError } from '../src/server/authError.js';
import { ACCEPTANCE_REQUIRED_REASON, isAcceptanceRequiredError } from '../src/acceptance.js';
import {
  EMAIL_VERIFICATION_REQUIRED_REASON,
  isEmailVerificationRequiredError,
} from '../src/email-verification.js';
import type { AssertAuthConfig, AssertAuthFn, UserStatus } from '../src/server/types.js';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import type { Mock } from 'vitest';

type TestUser = {
  uid: string;
  displayName?: string;
  status?: 'active' | 'suspended' | 'banned';
};

type TestAdminOptions = { level: 'basic' | 'elevated' };

type FakeCallableRequest = {
  data: object;
  rawRequest: object;
  auth?: { uid: string; token: Record<string, unknown> };
};

type UserDocSnapshot = {
  exists: boolean;
  data: () => Record<string, unknown> | null | undefined;
};
type UserDocRef = { get: () => Promise<UserDocSnapshot> };
type FirestoreFake = { doc: (path: string) => UserDocRef };
type RequireAdmin = AssertAuthConfig<TestUser, void, TestAdminOptions>['requireAdmin'];

function asCallableRequest(request: FakeCallableRequest): CallableRequest {
  return request as CallableRequest;
}

function asFirestore(fake: FirestoreFake): Firestore {
  return fake as Firestore;
}

function makeRequest(opts?: {
  uid?: string;
  emailVerified?: boolean;
  claims?: Record<string, unknown>;
}): CallableRequest {
  const uid = opts?.uid ?? 'uid-123';
  return asCallableRequest({
    data: {},
    rawRequest: {},
    auth: {
      uid,
      token: { uid, email_verified: opts?.emailVerified ?? true, ...opts?.claims },
    },
  });
}

function makeUnauthRequest(): CallableRequest {
  return asCallableRequest({ data: {}, rawRequest: {}, auth: undefined });
}

const activeUserDoc: TestUser = {
  uid: 'uid-123',
  displayName: 'Test User',
  status: 'active',
};

function fakeDbWithUser(): Firestore {
  const userDocRef: UserDocRef = {
    get: vi.fn<UserDocRef['get']>().mockResolvedValue({ exists: true, data: () => activeUserDoc }),
  };
  return asFirestore({ doc: vi.fn<FirestoreFake['doc']>(() => userDocRef) });
}

let mockUserGet: Mock<UserDocRef['get']>;
let mockRequireAdmin: Mock<RequireAdmin>;
let mockDbDoc: Mock<FirestoreFake['doc']>;
let assertAuth: AssertAuthFn<TestUser, void, TestAdminOptions>;

beforeEach(() => {
  mockUserGet = vi
    .fn<UserDocRef['get']>()
    .mockResolvedValue({ exists: true, data: () => activeUserDoc });
  mockRequireAdmin = vi.fn<RequireAdmin>().mockResolvedValue(undefined);

  const userDocRef: UserDocRef = { get: mockUserGet };

  mockDbDoc = vi.fn<FirestoreFake['doc']>(() => userDocRef);

  const fakeDb = asFirestore({ doc: mockDbDoc });

  const config: AssertAuthConfig<TestUser, void, TestAdminOptions> = {
    firestore: () => fakeDb,
    userProfilePath: (uid) => `profiles/${uid}`,
    getUserStatus: (user): UserStatus => {
      if (user.status === 'banned') return 'banned';
      if (user.status === 'suspended') return 'suspended';
      return 'active';
    },
    requireAdmin: mockRequireAdmin,
  };

  assertAuth = createAssertAuth<TestUser, void, TestAdminOptions>(config);
});

describe('throws a framework-free typed error (never a package-built HttpsError)', () => {
  it('rejects with an AuthAssertionError instance carrying the HttpsError code string', async () => {
    const err = await assertAuth(makeUnauthRequest()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect((err as AuthAssertionError).name).toBe('AuthAssertionError');
    expect((err as AuthAssertionError).code).toBe('unauthenticated');
  });

  it("does not decorate the error with HttpsError's own shape", async () => {
    const err = (await assertAuth(makeUnauthRequest()).catch(
      (e: unknown) => e,
    )) as AuthAssertionError & { httpErrorCode?: unknown; toJSON?: unknown };
    expect(err.httpErrorCode).toBeUndefined();
    expect(err.toJSON).toBeUndefined();
  });

  it('uses AuthAssertionError for the email-verification rejection too', async () => {
    const err = await assertAuth(makeRequest({ emailVerified: false }), {
      emailVerified: true,
      allowAnyStatus: true,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect((err as AuthAssertionError).code).toBe('failed-precondition');
  });
});

describe('Authentication', () => {
  it('throws unauthenticated when request.auth is absent', async () => {
    await expect(assertAuth(makeUnauthRequest())).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('succeeds with no Firestore reads when only allowAnyStatus is set', async () => {
    const ctx = await assertAuth(makeRequest(), { allowAnyStatus: true });
    expect(ctx.uid).toBe('uid-123');
    expect(ctx.userDoc).toBeUndefined();
    expect(mockDbDoc).not.toHaveBeenCalled();
  });
});

describe('Email verification', () => {
  it('throws failed-precondition when emailVerified required and token email_verified is false', async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: false }), {
        emailVerified: true,
        allowAnyStatus: true,
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('carries the email-verification reason in details, with the message unchanged', async () => {
    const err = await assertAuth(makeRequest({ emailVerified: false }), {
      emailVerified: true,
      allowAnyStatus: true,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect(err).toMatchObject({
      code: 'failed-precondition',
      message: 'Email must be verified',
      details: { reason: EMAIL_VERIFICATION_REQUIRED_REASON },
    });
    expect(isEmailVerificationRequiredError(err)).toBe(true);
    expect(isAcceptanceRequiredError(err)).toBe(false);
  });

  it('succeeds when emailVerified required and token email_verified is true', async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: true }), {
        emailVerified: true,
        allowAnyStatus: true,
      }),
    ).resolves.toMatchObject({ uid: 'uid-123' });
  });

  it('succeeds when allowUnverified is true even if email_verified is false', async () => {
    await expect(
      assertAuth(makeRequest({ emailVerified: false }), {
        emailVerified: true,
        allowUnverified: true,
        allowAnyStatus: true,
      }),
    ).resolves.toMatchObject({ uid: 'uid-123' });
  });
});

describe('Not-banned check (default behavior)', () => {
  it('throws permission-denied when user status is banned', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: 'banned' }),
    });
    await expect(assertAuth(makeRequest())).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('throws permission-denied when user status is suspended', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: 'suspended' }),
    });
    await expect(assertAuth(makeRequest())).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('throws not-found when user doc does not exist', async () => {
    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(assertAuth(makeRequest())).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('succeeds when user doc has no status field', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: 'uid-123', displayName: 'Test' }),
    });
    const ctx = await assertAuth(makeRequest());
    expect(ctx.uid).toBe('uid-123');
    expect(ctx.userDoc).toBeDefined();
  });

  it('succeeds when user status is active', async () => {
    const ctx = await assertAuth(makeRequest());
    expect(ctx.uid).toBe('uid-123');
    expect(ctx.userDoc).toMatchObject({ status: 'active' });
  });

  it('skips user doc read entirely when allowAnyStatus is true', async () => {
    await assertAuth(makeRequest(), { allowAnyStatus: true });
    expect(mockUserGet).not.toHaveBeenCalled();
  });
});

describe('allowSuspended opt-in', () => {
  it('allows a suspended user when allowSuspended is true', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: 'suspended' }),
    });
    const ctx = await assertAuth(makeRequest(), { allowSuspended: true });
    expect(ctx.uid).toBe('uid-123');
    expect(ctx.userDoc).toMatchObject({ status: 'suspended' });
  });

  it('still blocks a banned user even when allowSuspended is true', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: 'banned' }),
    });
    await expect(assertAuth(makeRequest(), { allowSuspended: true })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('still requires the user doc to exist when allowSuspended is true', async () => {
    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    await expect(assertAuth(makeRequest(), { allowSuspended: true })).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});

describe('Admin check', () => {
  it('propagates the error when requireAdmin throws', async () => {
    mockRequireAdmin.mockRejectedValue(
      Object.assign(new Error('Administrator access required'), {
        code: 'permission-denied',
      }),
    );
    await expect(
      assertAuth(makeRequest(), {
        admin: { level: 'basic' },
        allowAnyStatus: true,
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('succeeds and returns ctx when requireAdmin resolves', async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    const ctx = await assertAuth(makeRequest(), {
      admin: { level: 'elevated' },
      allowAnyStatus: true,
    });
    expect(ctx.uid).toBe('uid-123');
    expect(mockRequireAdmin).toHaveBeenCalledWith('uid-123', expect.any(Object), {
      level: 'elevated',
    });
  });

  it('populates ctx.admin with the requireAdmin result when an admin check runs', async () => {
    type AdminResult = { role: string };
    const adminMock = vi
      .fn<AssertAuthConfig<TestUser, AdminResult, TestAdminOptions>['requireAdmin']>()
      .mockResolvedValue({ role: 'superadmin' });
    const config: AssertAuthConfig<TestUser, AdminResult, TestAdminOptions> = {
      firestore: () => fakeDbWithUser(),
      userProfilePath: (uid) => `profiles/${uid}`,
      getUserStatus: (user): UserStatus => {
        if (user.status === 'banned') return 'banned';
        if (user.status === 'suspended') return 'suspended';
        return 'active';
      },
      requireAdmin: adminMock,
    };
    const typedAssertAuth = createAssertAuth<TestUser, AdminResult, TestAdminOptions>(config);

    const ctx = await typedAssertAuth(makeRequest(), {
      admin: { level: 'elevated' },
    });

    expect(ctx.admin).toEqual({ role: 'superadmin' });
  });

  it('types an admin requirement as unavailable when the app declares no admin options type', async () => {
    const config: AssertAuthConfig<TestUser> = {
      firestore: () => fakeDbWithUser(),
      userProfilePath: (uid) => `profiles/${uid}`,
      getUserStatus: (): UserStatus => 'active',
      requireAdmin: mockRequireAdmin,
    };
    const untyped = createAssertAuth<TestUser>(config);
    await expect(
      // @ts-expect-error an admin requirement needs the app's admin options type
      untyped(makeRequest(), { admin: { level: 'elevated' } }),
    ).resolves.toMatchObject({ uid: 'uid-123' });
  });

  it('leaves ctx.admin undefined when no admin requirement is set', async () => {
    const ctx = await assertAuth(makeRequest());
    expect(ctx.admin).toBeUndefined();
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });
});

describe('Combined checks', () => {
  it('returns fully populated ctx when all checks pass', async () => {
    mockUserGet.mockResolvedValue({ exists: true, data: () => activeUserDoc });
    mockRequireAdmin.mockResolvedValue(undefined);

    const ctx = await assertAuth(makeRequest({ emailVerified: true }), {
      emailVerified: true,
      admin: { level: 'elevated' },
    });

    expect(ctx.uid).toBe('uid-123');
    expect(ctx.userDoc).toMatchObject({ status: 'active' });
    expect(mockRequireAdmin).toHaveBeenCalled();
  });
});

describe('Acceptance-level gate', () => {
  const CLAIM = 'acceptedLevelClaim';

  function gatedAssertAuth(requiredLevel: () => number | Promise<number>) {
    const requireAdmin = vi
      .fn<AssertAuthConfig<TestUser, string, TestAdminOptions>['requireAdmin']>()
      .mockResolvedValue('admin');
    const config: AssertAuthConfig<TestUser, string, TestAdminOptions> = {
      firestore: () => fakeDbWithUser(),
      userProfilePath: (uid) => `profiles/${uid}`,
      getUserStatus: (user): UserStatus => (user.status === 'banned' ? 'banned' : 'active'),
      requireAdmin,
      acceptance: { claimKey: CLAIM, requiredLevel },
    };
    return { assert: createAssertAuth<TestUser, string, TestAdminOptions>(config), requireAdmin };
  }

  function requestWithClaim(claim: unknown): CallableRequest {
    return makeRequest(claim === undefined ? undefined : { claims: { [CLAIM]: claim } });
  }

  it('refuses a caller below the required level with a structured failed-precondition', async () => {
    const { assert } = gatedAssertAuth(() => 3);
    const err = await assert(requestWithClaim(2)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect(err).toMatchObject({
      code: 'failed-precondition',
      details: { reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 3, acceptedLevel: 2 },
    });
    expect(isAcceptanceRequiredError(err)).toBe(true);
    expect(isEmailVerificationRequiredError(err)).toBe(false);
  });

  it('treats a missing claim as accepted level 0', async () => {
    const { assert } = gatedAssertAuth(() => 1);
    await expect(assert(requestWithClaim(undefined))).rejects.toMatchObject({
      details: { reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel: 1, acceptedLevel: 0 },
    });
  });

  it.each([
    ['a string', '5'],
    ['NaN', Number.NaN],
    ['a negative', -4],
    ['null', null],
  ])('treats %s claim as accepted level 0 (fails closed)', async (_label, claim) => {
    const { assert } = gatedAssertAuth(() => 1);
    await expect(assert(requestWithClaim(claim))).rejects.toMatchObject({
      details: { acceptedLevel: 0 },
    });
  });

  it('passes a caller at or above the required level', async () => {
    const { assert } = gatedAssertAuth(() => 3);
    await expect(assert(requestWithClaim(3))).resolves.toMatchObject({ uid: 'uid-123' });
    await expect(assert(requestWithClaim(7))).resolves.toMatchObject({ uid: 'uid-123' });
  });

  it('awaits an async required-level reader', async () => {
    const { assert } = gatedAssertAuth(async () => 2);
    await expect(assert(requestWithClaim(1))).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it.each([
    ['zero', 0],
    ['NaN', Number.NaN],
    ['a negative', -1],
  ])('requires nothing when the required level is %s', async (_label, level) => {
    const { assert } = gatedAssertAuth(() => level);
    await expect(assert(requestWithClaim(undefined))).resolves.toMatchObject({ uid: 'uid-123' });
  });

  it('lets an allowUnaccepted callable through without reading the required level', async () => {
    const requiredLevel = vi.fn(() => 9);
    const { assert } = gatedAssertAuth(requiredLevel);
    await expect(
      assert(requestWithClaim(undefined), { allowUnaccepted: true }),
    ).resolves.toMatchObject({
      uid: 'uid-123',
    });
    expect(requiredLevel).not.toHaveBeenCalled();
  });

  it('propagates a throwing required-level reader', async () => {
    const failure = new Error('config unavailable');
    const { assert } = gatedAssertAuth(() => {
      throw failure;
    });
    await expect(assert(requestWithClaim(5))).rejects.toBe(failure);
  });

  it('refuses before the admin check runs', async () => {
    const { assert, requireAdmin } = gatedAssertAuth(() => 2);
    await expect(
      assert(requestWithClaim(1), { admin: { level: 'elevated' }, allowAnyStatus: true }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it('still gates a callable that skips the status check (allowAnyStatus)', async () => {
    const { assert } = gatedAssertAuth(() => 1);
    await expect(assert(requestWithClaim(0), { allowAnyStatus: true })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('keeps authentication first — an unauthenticated caller never reaches the gate', async () => {
    const requiredLevel = vi.fn(() => 1);
    const { assert } = gatedAssertAuth(requiredLevel);
    await expect(assert(makeUnauthRequest())).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(requiredLevel).not.toHaveBeenCalled();
  });

  it('is off without config: a caller with no level claim passes', async () => {
    await expect(assertAuth(makeRequest(), { allowUnaccepted: false })).resolves.toMatchObject({
      uid: 'uid-123',
    });
  });

  it('leaves `details` undefined on every other rejection', async () => {
    const unauthenticated = (await assertAuth(makeUnauthRequest()).catch(
      (e: unknown) => e,
    )) as AuthAssertionError;
    expect(unauthenticated.details).toBeUndefined();

    mockUserGet.mockResolvedValue({ exists: false, data: () => null });
    const missingProfile = (await assertAuth(makeRequest()).catch(
      (e: unknown) => e,
    )) as AuthAssertionError;
    expect(missingProfile.code).toBe('not-found');
    expect(missingProfile.details).toBeUndefined();

    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...activeUserDoc, status: 'banned' }),
    });
    const banned = (await assertAuth(makeRequest()).catch((e: unknown) => e)) as AuthAssertionError;
    expect(banned.code).toBe('permission-denied');
    expect(banned.details).toBeUndefined();
  });
});
