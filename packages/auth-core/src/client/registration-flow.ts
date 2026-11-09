import { signInWithEmailAndPassword } from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';

export class RegistrationNotCompletedError extends Error {
  constructor() {
    super('The registration did not complete.');
    this.name = 'RegistrationNotCompletedError';
  }
}

export function isRegistrationNotCompletedError(error: unknown): boolean {
  return error instanceof RegistrationNotCompletedError;
}

const CREDENTIAL_REFUSAL_CODES: ReadonlySet<string> = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/user-not-found',
  'auth/wrong-password',
]);

function isCredentialRefusal(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && CREDENTIAL_REFUSAL_CODES.has(code);
}

export interface RegisterAndSignInOptions {
  readonly auth: Auth;
  readonly email: string;
  readonly password: string;
  readonly register: () => Promise<unknown>;
  readonly isUnknownOutcome: (error: unknown) => boolean;
}

async function signIn(options: RegisterAndSignInOptions): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    options.auth,
    options.email,
    options.password,
  );
  return credential.user;
}

export async function registerAndSignIn(options: RegisterAndSignInOptions): Promise<User> {
  try {
    await options.register();
  } catch (error) {
    if (!options.isUnknownOutcome(error)) throw error;
    // The server leaves a login only once it holds its whole account, so a working sign-in proves
    // the registration finished and a refused one proves it did not.
    try {
      return await signIn(options);
    } catch (signInError) {
      if (isCredentialRefusal(signInError)) throw new RegistrationNotCompletedError();
      throw signInError;
    }
  }
  return signIn(options);
}
