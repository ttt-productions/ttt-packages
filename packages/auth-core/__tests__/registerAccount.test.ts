import { describe, expect, it, vi } from 'vitest';
import type { CreateRequest } from 'firebase-admin/auth';
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  RegistrationRefusalError,
  registerAccount,
} from '../src/server/registerAccount.js';
import type {
  AccountRegistrationAdapter,
  AccountRegistrationRequest,
  RegistrationAuth,
} from '../src/server/registerAccount.js';
import { DEFAULT_PASSWORD_POLICY, definePasswordPolicy } from '../src/password-policy.js';

const REQUEST: AccountRegistrationRequest = {
  email: 'new@example.com',
  password: 'correct horse',
  displayName: 'New Player',
};

function authError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function fakeAuth(createUser?: (properties: CreateRequest) => Promise<{ uid: string }>) {
  const created: CreateRequest[] = [];
  const deleted: string[] = [];
  const auth: RegistrationAuth = {
    createUser: async (properties) => {
      created.push(properties);
      return createUser ? createUser(properties) : { uid: 'uid-new' };
    },
    deleteUser: async (uid) => {
      deleted.push(uid);
    },
  };
  return { auth, created, deleted };
}

function adapter(
  auth: RegistrationAuth,
  overrides: Partial<AccountRegistrationAdapter<AccountRegistrationRequest, string>> = {},
): AccountRegistrationAdapter<AccountRegistrationRequest, string> {
  return {
    auth: () => auth,
    passwordPolicy: DEFAULT_PASSWORD_POLICY,
    preCheck: async () => {},
    writeAccount: async (uid) => `account-${uid}`,
    onLoginDeleteFailure: () => {},
    ...overrides,
  };
}

describe('registerAccount', () => {
  it('creates the login with the display name, then writes the account under its uid', async () => {
    const { auth, created, deleted } = fakeAuth();
    const writeAccount = vi.fn(async (uid: string) => `account-${uid}`);

    const registration = await registerAccount(adapter(auth, { writeAccount }), REQUEST);

    expect(registration).toEqual({ uid: 'uid-new', result: 'account-uid-new' });
    expect(created).toEqual([
      { email: REQUEST.email, password: REQUEST.password, displayName: REQUEST.displayName },
    ]);
    expect(writeAccount).toHaveBeenCalledWith('uid-new', REQUEST);
    expect(deleted).toEqual([]);
  });

  it('deletes the login and rethrows when the account write refuses', async () => {
    const { auth, deleted } = fakeAuth();
    const refusal = new Error('display name taken');

    await expect(
      registerAccount(
        adapter(auth, {
          writeAccount: async () => {
            throw refusal;
          },
        }),
        REQUEST,
      ),
    ).rejects.toBe(refusal);
    expect(deleted).toEqual(['uid-new']);
  });

  it('reports a failed delete and still answers with the write failure', async () => {
    const deleteFailure = new Error('auth unavailable');
    const writeFailure = new Error('transaction aborted');
    const onLoginDeleteFailure = vi.fn();
    const auth: RegistrationAuth = {
      createUser: async () => ({ uid: 'uid-new' }),
      deleteUser: async () => {
        throw deleteFailure;
      },
    };

    await expect(
      registerAccount(
        adapter(auth, {
          writeAccount: async () => {
            throw writeFailure;
          },
          onLoginDeleteFailure,
        }),
        REQUEST,
      ),
    ).rejects.toBe(writeFailure);
    expect(onLoginDeleteFailure).toHaveBeenCalledWith(deleteFailure, 'uid-new');
  });

  it('creates no login when a pre-check refuses', async () => {
    const { auth, created } = fakeAuth();
    const closed = new Error('registration is closed');
    const writeAccount = vi.fn(async () => 'never');

    await expect(
      registerAccount(
        adapter(auth, {
          preCheck: async () => {
            throw closed;
          },
          writeAccount,
        }),
        REQUEST,
      ),
    ).rejects.toBe(closed);
    expect(created).toEqual([]);
    expect(writeAccount).not.toHaveBeenCalled();
  });

  it('checks the password against the product policy before anything else', async () => {
    const { auth, created } = fakeAuth();
    const preCheck = vi.fn(async () => {});
    const policy = definePasswordPolicy({ minLength: 20 });

    const answer = registerAccount(adapter(auth, { passwordPolicy: policy, preCheck }), REQUEST);

    await expect(answer).rejects.toBeInstanceOf(RegistrationRefusalError);
    await expect(answer).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { reason: 'password-refused' },
      message: 'Password must be at least 20 characters.',
    });
    expect(preCheck).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it('answers an email that already has a login as a designed refusal, writing nothing', async () => {
    const { auth, deleted } = fakeAuth(async () => {
      throw authError('auth/email-already-exists');
    });
    const writeAccount = vi.fn(async () => 'never');

    await expect(registerAccount(adapter(auth, { writeAccount }), REQUEST)).rejects.toMatchObject({
      code: 'already-exists',
      details: { reason: 'email-already-registered' },
      message: EMAIL_ALREADY_REGISTERED_MESSAGE,
    });
    expect(writeAccount).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
  });

  it('answers a password Auth refuses as a designed refusal', async () => {
    const { auth } = fakeAuth(async () => {
      throw authError('auth/invalid-password');
    });

    await expect(registerAccount(adapter(auth), REQUEST)).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { reason: 'password-refused' },
    });
  });

  it('rethrows any other create failure as it is, writing nothing', async () => {
    const outage = authError('auth/internal-error');
    const { auth } = fakeAuth(async () => {
      throw outage;
    });
    const writeAccount = vi.fn(async () => 'never');

    await expect(registerAccount(adapter(auth, { writeAccount }), REQUEST)).rejects.toBe(outage);
    expect(writeAccount).not.toHaveBeenCalled();
  });

  it('never puts the password in a refusal', async () => {
    const { auth } = fakeAuth(async () => {
      throw authError('auth/email-already-exists');
    });
    const short = { ...REQUEST, password: 'tiny' };

    for (const request of [REQUEST, short]) {
      const error: unknown = await registerAccount(adapter(auth), request).catch(
        (thrown: unknown) => thrown,
      );
      expect(JSON.stringify(error)).not.toContain(request.password);
      expect(String(error)).not.toContain(request.password);
    }
  });
});
