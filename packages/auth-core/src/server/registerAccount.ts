import type { CreateRequest } from 'firebase-admin/auth';
import { checkPassword, passwordIssueMessage } from '../password-policy.js';
import type { PasswordPolicy } from '../password-policy.js';
import { REGISTRATION_REFUSAL_CODES } from '../registration.js';
import type {
  RegistrationRefusalCode,
  RegistrationRefusalDetails,
  RegistrationRefusalReason,
} from '../registration.js';

export interface RegistrationAuth {
  createUser(properties: CreateRequest): Promise<{ readonly uid: string }>;
  deleteUser(uid: string): Promise<void>;
}

export interface AccountRegistrationRequest {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
}

export interface AccountRegistrationAdapter<TRequest extends AccountRegistrationRequest, TResult> {
  readonly auth: () => RegistrationAuth;
  readonly passwordPolicy: PasswordPolicy;
  readonly preCheck: (request: TRequest) => Promise<void>;
  readonly writeAccount: (uid: string, request: TRequest) => Promise<TResult>;
  readonly onLoginDeleteFailure: (error: unknown, uid: string) => void;
}

export interface AccountRegistration<TResult> {
  readonly uid: string;
  readonly result: TResult;
}

// firebase-functions' callable runtime instanceof-checks its own HttpsError class, which one built
// in this package's ESM dist fails (a 500 INTERNAL), so the consuming app builds the HttpsError.
export class RegistrationRefusalError extends Error {
  readonly code: RegistrationRefusalCode;
  readonly details: RegistrationRefusalDetails;

  constructor(reason: RegistrationRefusalReason, message: string) {
    super(message);
    this.name = 'RegistrationRefusalError';
    this.code = REGISTRATION_REFUSAL_CODES[reason];
    this.details = { reason };
  }
}

export const EMAIL_ALREADY_REGISTERED_MESSAGE = 'An account with that email already exists.';
export const PASSWORD_REFUSED_MESSAGE = 'That password cannot be used. Please choose another.';

const CREATE_USER_REFUSALS: Readonly<Record<string, RegistrationRefusalReason>> = {
  'auth/email-already-exists': 'email-already-registered',
  'auth/invalid-password': 'password-refused',
};

const REFUSAL_MESSAGES: Readonly<Record<RegistrationRefusalReason, string>> = {
  'email-already-registered': EMAIL_ALREADY_REGISTERED_MESSAGE,
  'password-refused': PASSWORD_REFUSED_MESSAGE,
};

function createUserRefusal(error: unknown): RegistrationRefusalReason | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? (CREATE_USER_REFUSALS[code] ?? null) : null;
}

export async function registerAccount<TRequest extends AccountRegistrationRequest, TResult>(
  adapter: AccountRegistrationAdapter<TRequest, TResult>,
  request: TRequest,
): Promise<AccountRegistration<TResult>> {
  const password = checkPassword(request.password, adapter.passwordPolicy);
  if (!password.ok) {
    throw new RegistrationRefusalError(
      'password-refused',
      passwordIssueMessage(password.issue, adapter.passwordPolicy),
    );
  }

  await adapter.preCheck(request);

  let uid: string;
  try {
    const created = await adapter.auth().createUser({
      email: request.email,
      password: request.password,
      displayName: request.displayName,
    });
    uid = created.uid;
  } catch (error) {
    const refusal = createUserRefusal(error);
    if (refusal) throw new RegistrationRefusalError(refusal, REFUSAL_MESSAGES[refusal]);
    throw error;
  }

  try {
    return { uid, result: await adapter.writeAccount(uid, request) };
  } catch (error) {
    try {
      await adapter.auth().deleteUser(uid);
    } catch (deleteError) {
      adapter.onLoginDeleteFailure(deleteError, uid);
    }
    throw error;
  }
}
