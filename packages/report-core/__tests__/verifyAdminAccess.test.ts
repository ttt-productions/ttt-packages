import { describe, it, expect, vi } from 'vitest';
import { verifyAdminAccess } from '../src/server/verifyAdminAccess.js';
import { ReportCoreTaskError } from '../src/server/taskError.js';

const permissionRefusal = () =>
  Object.assign(new Error('Administrator access required'), { code: 'permission-denied' });

describe('verifyAdminAccess', () => {
  it('admits a caller the app resolves as an admin', async () => {
    const requireAdmin = vi.fn().mockResolvedValue(undefined);
    await expect(verifyAdminAccess({ requireAdmin }, 'u1', 'tok')).resolves.toBeUndefined();
    expect(requireAdmin).toHaveBeenCalledWith('u1', 'tok');
  });

  it('admits a refused caller who is on the admin list', async () => {
    const requireAdmin = vi.fn().mockRejectedValue(permissionRefusal());
    await expect(
      verifyAdminAccess({ requireAdmin, adminUserIds: ['u1'] }, 'u1', null),
    ).resolves.toBeUndefined();
  });

  it('refuses a caller the app refuses and the list does not name', async () => {
    const requireAdmin = vi.fn().mockRejectedValue(permissionRefusal());
    const error = await verifyAdminAccess({ requireAdmin, adminUserIds: ['u2'] }, 'u1', null).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ReportCoreTaskError);
    expect((error as ReportCoreTaskError).code).toBe('permission-denied');
  });

  it('surfaces a failed admin lookup as itself, never as "not an admin"', async () => {
    const outage = Object.assign(new Error('Admin system configuration error'), {
      code: 'internal',
    });
    const requireAdmin = vi.fn().mockRejectedValue(outage);
    await expect(
      verifyAdminAccess({ requireAdmin, adminUserIds: ['u1'] }, 'u1', null),
    ).rejects.toBe(outage);
  });

  it('surfaces a thrown error with no code as itself', async () => {
    const outage = new Error('network down');
    const requireAdmin = vi.fn().mockRejectedValue(outage);
    await expect(verifyAdminAccess({ requireAdmin }, 'u1', null)).rejects.toBe(outage);
  });

  it('admits every caller when no admin check is configured', async () => {
    await expect(verifyAdminAccess(undefined, 'u1', null)).resolves.toBeUndefined();
  });
});
