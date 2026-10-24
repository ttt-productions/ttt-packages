import type { AdminAuthConfig } from './types.js';
import { ReportCoreTaskError } from './taskError.js';

function isPermissionRefusal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'permission-denied'
  );
}

export async function verifyAdminAccess(
  auth: AdminAuthConfig | undefined,
  uid: string,
  authToken: unknown,
): Promise<void> {
  if (!auth) return;
  if (auth.requireAdmin) {
    try {
      await auth.requireAdmin(uid, authToken);
      return;
    } catch (error) {
      if (!isPermissionRefusal(error)) throw error;
    }
  }
  if (auth.adminUserIds?.includes(uid)) return;
  throw new ReportCoreTaskError('permission-denied', 'Administrator access required');
}
