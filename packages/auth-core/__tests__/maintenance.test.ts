import { describe, expect, it, vi } from 'vitest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  MAINTENANCE_REFUSAL_CODE,
  MAINTENANCE_REFUSAL_REASON,
  isMaintenanceRefusalDetails,
  isMaintenanceRefusalError,
} from '../src/maintenance.js';
import { AuthAssertionError } from '../src/server/authError.js';
import { createMaintenanceCheck } from '../src/server/maintenanceCheck.js';
import type { MaintenanceGateConfig } from '../src/server/types.js';

const MESSAGE = 'Down for maintenance, back soon.';
const TOKEN = { uid: 'uid-1' } as DecodedIdToken;

function check(on: boolean, admin: boolean) {
  const isAdmin = vi.fn<MaintenanceGateConfig['isAdmin']>().mockResolvedValue(admin);
  const read = vi.fn<MaintenanceGateConfig['read']>().mockResolvedValue({ on, message: MESSAGE });
  return { assertNotInMaintenance: createMaintenanceCheck({ read, isAdmin }), isAdmin, read };
}

describe('the maintenance check', () => {
  it('passes everyone while maintenance is off, asking no admin check', async () => {
    const { assertNotInMaintenance, isAdmin } = check(false, false);
    await expect(assertNotInMaintenance({ uid: 'uid-1', token: TOKEN })).resolves.toBeUndefined();
    await expect(assertNotInMaintenance()).resolves.toBeUndefined();
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it('passes an admin caller while maintenance is on', async () => {
    const { assertNotInMaintenance, isAdmin } = check(true, true);
    await expect(assertNotInMaintenance({ uid: 'uid-1', token: TOKEN })).resolves.toBeUndefined();
    expect(isAdmin).toHaveBeenCalledWith('uid-1', TOKEN);
  });

  it('refuses any other caller with the product message and the maintenance reason', async () => {
    const { assertNotInMaintenance } = check(true, false);
    const err = await assertNotInMaintenance({ uid: 'uid-1', token: TOKEN }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(AuthAssertionError);
    expect(err).toMatchObject({
      code: MAINTENANCE_REFUSAL_CODE,
      message: MESSAGE,
      details: { reason: MAINTENANCE_REFUSAL_REASON },
    });
    expect(isMaintenanceRefusalError(err)).toBe(true);
  });

  it('refuses an entry point with no caller, asking no admin check', async () => {
    const { assertNotInMaintenance, isAdmin } = check(true, true);
    await expect(assertNotInMaintenance()).rejects.toMatchObject({
      code: MAINTENANCE_REFUSAL_CODE,
      message: MESSAGE,
    });
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it('fails with the read when the product cannot read maintenance', async () => {
    const readFailure = new Error('config read failed');
    const assertNotInMaintenance = createMaintenanceCheck({
      read: () => Promise.reject(readFailure),
      isAdmin: async () => true,
    });
    await expect(assertNotInMaintenance()).rejects.toBe(readFailure);
  });
});

describe('recognizing the maintenance refusal', () => {
  it('reads it from a server or a client error by code and reason, never by message', () => {
    const details = { reason: MAINTENANCE_REFUSAL_REASON };
    expect(isMaintenanceRefusalError({ code: 'unavailable', details })).toBe(true);
    expect(isMaintenanceRefusalError({ code: 'functions/unavailable', details })).toBe(true);
    expect(isMaintenanceRefusalError({ code: 'unavailable', message: MESSAGE })).toBe(false);
    expect(isMaintenanceRefusalError(new Error(MESSAGE))).toBe(false);
  });

  it('refuses the reason under another code, and other details under its code', () => {
    expect(
      isMaintenanceRefusalError({
        code: 'failed-precondition',
        details: { reason: 'maintenance' },
      }),
    ).toBe(false);
    expect(isMaintenanceRefusalError({ code: 'unavailable', details: 'maintenance' })).toBe(false);
    expect(isMaintenanceRefusalError({ code: 503, details: { reason: 'maintenance' } })).toBe(
      false,
    );
    expect(isMaintenanceRefusalError(null)).toBe(false);
    expect(isMaintenanceRefusalDetails({ reason: 'maintenance' })).toBe(true);
    expect(isMaintenanceRefusalDetails({ reason: 'sign-in-required' })).toBe(false);
  });
});
