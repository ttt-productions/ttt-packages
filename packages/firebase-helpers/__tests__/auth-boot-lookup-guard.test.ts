import { describe, it, expect, vi } from 'vitest';
import {
  classifyBootLookupFailure,
  runGuardedBootLookup,
  type BootLookupResponse,
} from '../src/client/auth-boot-lookup-guard.js';

const instantSleep = vi.fn(async () => undefined);

function errorResponse(status: number, message: string): BootLookupResponse {
  return {
    ok: false,
    status,
    clone: () => ({ json: async () => ({ error: { code: status, message } }) }),
  };
}

const okResponse: BootLookupResponse = {
  ok: true,
  status: 200,
  clone: () => ({ json: async () => ({}) }),
};

// The shapes @firebase/auth's SERVER_ERROR_MAP and _performFetchWithErrorHandling produce.
const APP_CHECK_401 = 'Firebase App Check token is invalid.';
const INVALID_ID_TOKEN = 'INVALID_ID_TOKEN';
const TOKEN_EXPIRED = 'TOKEN_EXPIRED';
const USER_DISABLED = 'USER_DISABLED : the account has been disabled';
const MISSING_PROJECT_ID = 'MISSING_PROJECT_ID';

describe('classifyBootLookupFailure', () => {
  it('classes the App Check 401 as attestation, not identity', () => {
    expect(classifyBootLookupFailure({ status: 401, message: APP_CHECK_401 })).toBe('attestation');
  });

  it('classes a bare 401 with no readable body as attestation', () => {
    expect(classifyBootLookupFailure({ status: 401, message: '' })).toBe('attestation');
  });

  it.each([
    ['auth/invalid-user-token', INVALID_ID_TOKEN],
    ['auth/user-token-expired', TOKEN_EXPIRED],
    ['auth/user-token-expired', 'USER_NOT_FOUND'],
    ['auth/user-disabled', USER_DISABLED],
    ['auth/requires-recent-login', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN'],
  ])('classes %s (%s) as identity', (_authCode, serverMessage) => {
    expect(classifyBootLookupFailure({ status: 400, message: serverMessage })).toBe('identity');
  });

  it('classes a Google-side 400 on a valid token as transient, not identity', () => {
    expect(classifyBootLookupFailure({ status: 400, message: MISSING_PROJECT_ID })).toBe(
      'transient',
    );
  });

  it('classes a 5xx as transient', () => {
    expect(classifyBootLookupFailure({ status: 503, message: 'backend unavailable' })).toBe(
      'transient',
    );
  });
});

describe('runGuardedBootLookup', () => {
  it('IDENTITY failure: returns the response untouched so the SDK purges — no retry', async () => {
    const response = errorResponse(400, INVALID_ID_TOKEN);
    const attempt = vi.fn(async () => response);
    const onFailure = vi.fn();

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, onFailure, delaysMs: [1, 2] }),
    ).resolves.toBe(response);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith('identity');
  });

  it('ATTESTATION failure: retries with a fresh App Check token and recovers — session kept, no purge', async () => {
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockResolvedValueOnce(errorResponse(401, APP_CHECK_401))
      .mockResolvedValueOnce(okResponse);
    const refreshAttestation = vi.fn(async () => undefined);
    const sleep = vi.fn(async (_ms: number) => undefined);

    await expect(
      runGuardedBootLookup({ attempt, refreshAttestation, sleep, delaysMs: [10, 20] }),
    ).resolves.toBe(okResponse);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(refreshAttestation).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10]);
  });

  it('ATTESTATION failure that never clears: throws so the SDK reads network and KEEPS the session', async () => {
    const attempt = vi.fn(async () => errorResponse(401, APP_CHECK_401));
    const refreshAttestation = vi.fn(async () => undefined);

    await expect(
      runGuardedBootLookup({
        attempt,
        refreshAttestation,
        sleep: instantSleep,
        delaysMs: [10, 20],
      }),
    ).rejects.toThrow(/attestation/);

    expect(attempt).toHaveBeenCalledTimes(3);
    expect(refreshAttestation).toHaveBeenCalledTimes(2);
  });

  it('ATTESTATION first, IDENTITY on retry: purges after all', async () => {
    const identity = errorResponse(400, TOKEN_EXPIRED);
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockResolvedValueOnce(errorResponse(401, APP_CHECK_401))
      .mockResolvedValueOnce(identity);
    const onFailure = vi.fn();

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, onFailure, delaysMs: [10, 20] }),
    ).resolves.toBe(identity);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(onFailure.mock.calls.map((c) => c[0])).toEqual(['attestation', 'identity']);
  });

  it('NETWORK failure: retries and recovers — session kept, no purge', async () => {
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse);
    const refreshAttestation = vi.fn(async () => undefined);
    const onFailure = vi.fn();

    await expect(
      runGuardedBootLookup({
        attempt,
        refreshAttestation,
        sleep: instantSleep,
        onFailure,
        delaysMs: [10, 20],
      }),
    ).resolves.toBe(okResponse);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith('network');
    expect(refreshAttestation).not.toHaveBeenCalled();
  });

  it('NETWORK failure that never clears: rethrows the transport error — the SDK keeps the session', async () => {
    const transportError = new TypeError('Failed to fetch');
    const attempt = vi.fn(async () => {
      throw transportError;
    });

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, delaysMs: [10, 20] }),
    ).rejects.toBe(transportError);

    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('a transient Google-side 400 is retried, never purged', async () => {
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockResolvedValueOnce(errorResponse(400, MISSING_PROJECT_ID))
      .mockResolvedValueOnce(okResponse);

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, delaysMs: [10, 20] }),
    ).resolves.toBe(okResponse);

    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('a successful lookup returns immediately with no classification', async () => {
    const attempt = vi.fn(async () => okResponse);
    const onFailure = vi.fn();

    await expect(runGuardedBootLookup({ attempt, sleep: instantSleep, onFailure })).resolves.toBe(
      okResponse,
    );

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });
});
