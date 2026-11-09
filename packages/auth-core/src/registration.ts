export interface RegistrationEngineSettings {
  readonly functionTimeoutSeconds: number;
}

export function defineRegistrationEngineSettings(
  values: RegistrationEngineSettings,
): RegistrationEngineSettings {
  const settings = { functionTimeoutSeconds: values.functionTimeoutSeconds };
  if (!Number.isInteger(settings.functionTimeoutSeconds) || settings.functionTimeoutSeconds < 1) {
    throw new TypeError(
      `A registration function timeout is a whole number of seconds (got ${settings.functionTimeoutSeconds}).`,
    );
  }
  return Object.freeze(settings);
}

export type RegistrationRefusalReason = 'email-already-registered' | 'password-refused';

export type RegistrationRefusalCode = 'already-exists' | 'invalid-argument';

export const REGISTRATION_REFUSAL_CODES: Readonly<
  Record<RegistrationRefusalReason, RegistrationRefusalCode>
> = Object.freeze({
  'email-already-registered': 'already-exists',
  'password-refused': 'invalid-argument',
});

export interface RegistrationRefusalDetails {
  readonly reason: RegistrationRefusalReason;
}

function isRegistrationRefusalReason(value: unknown): value is RegistrationRefusalReason {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(REGISTRATION_REFUSAL_CODES, value)
  );
}

export function isRegistrationRefusalDetails(
  details: unknown,
): details is RegistrationRefusalDetails {
  if (!details || typeof details !== 'object') return false;
  return isRegistrationRefusalReason((details as Record<string, unknown>).reason);
}

// A client SDK error carries its code with a `functions/` prefix; the server carries it bare.
export function registrationRefusalReason(err: unknown): RegistrationRefusalReason | null {
  if (!err || typeof err !== 'object') return null;
  const { code, details } = err as { code?: unknown; details?: unknown };
  if (typeof code !== 'string' || !isRegistrationRefusalDetails(details)) return null;
  const expected = REGISTRATION_REFUSAL_CODES[details.reason];
  return code === expected || code === `functions/${expected}` ? details.reason : null;
}
