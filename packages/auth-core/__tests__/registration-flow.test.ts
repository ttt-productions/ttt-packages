import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth, User, UserCredential } from 'firebase/auth';

const mockSignIn =
  vi.fn<(auth: Auth, email: string, password: string) => Promise<UserCredential>>();
vi.mock(import('firebase/auth'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    signInWithEmailAndPassword: (auth, email, password) => mockSignIn(auth, email, password),
  });
});

import {
  RegistrationNotCompletedError,
  isRegistrationNotCompletedError,
  registerAndSignIn,
} from '../src/client/registration-flow.js';
import { testAuth } from './helpers/test-auth.js';
import { testUser } from './helpers/test-user.js';

const auth = testAuth(() => null);
const signedIn = testUser('uid-new');
const DEADLINE = Object.assign(new Error('deadline'), { code: 'functions/deadline-exceeded' });

function credential(user: User): UserCredential {
  return { user, providerId: null, operationType: 'signIn' };
}

function authError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function options(register: () => Promise<unknown>) {
  return {
    auth,
    email: 'new@example.com',
    password: 'correct horse',
    register,
    isUnknownOutcome: (error: unknown) => error === DEADLINE,
  };
}

beforeEach(() => {
  mockSignIn.mockReset();
});

describe('registerAndSignIn', () => {
  it('signs in with the same email and password only after the registration answers', async () => {
    const order: string[] = [];
    mockSignIn.mockImplementation(async () => {
      order.push('sign in');
      return credential(signedIn);
    });

    const user = await registerAndSignIn(
      options(async () => {
        order.push('register');
      }),
    );

    expect(user).toBe(signedIn);
    expect(order).toEqual(['register', 'sign in']);
    expect(mockSignIn).toHaveBeenCalledWith(auth, 'new@example.com', 'correct horse');
  });

  it('never signs in when the registration is refused', async () => {
    const refusal = authError('functions/already-exists');

    await expect(
      registerAndSignIn(
        options(async () => {
          throw refusal;
        }),
      ),
    ).rejects.toBe(refusal);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('settles an unknown outcome by a sign-in that works: the account exists', async () => {
    mockSignIn.mockResolvedValue(credential(signedIn));

    const user = await registerAndSignIn(
      options(async () => {
        throw DEADLINE;
      }),
    );

    expect(user).toBe(signedIn);
  });

  it('settles an unknown outcome by a sign-in Auth refuses: the registration failed', async () => {
    mockSignIn.mockRejectedValue(authError('auth/invalid-credential'));

    const answer = registerAndSignIn(
      options(async () => {
        throw DEADLINE;
      }),
    );

    await expect(answer).rejects.toBeInstanceOf(RegistrationNotCompletedError);
    expect(isRegistrationNotCompletedError(await answer.catch((error: unknown) => error))).toBe(
      true,
    );
  });

  it('keeps an unknown outcome unknown when the settling sign-in itself fails to answer', async () => {
    const offline = authError('auth/network-request-failed');
    mockSignIn.mockRejectedValue(offline);

    await expect(
      registerAndSignIn(
        options(async () => {
          throw DEADLINE;
        }),
      ),
    ).rejects.toBe(offline);
  });
});
