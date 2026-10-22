import type { AdminList } from '../doc-schemas/system.js';
import { systemRoleSchema, type SystemRole } from '../schemas/atoms.js';

export type AdminStanding = SystemRole | 'none';

function uidsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function adminRosterOf(data: unknown): AdminList {
  const record = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return { admins: uidsOf(record.admins), jrAdmins: uidsOf(record.jrAdmins) };
}

export function adminStandingOf(roster: AdminList, uid: string): AdminStanding {
  if (roster.admins.includes(uid)) return systemRoleSchema.enum.admin;
  if (roster.jrAdmins.includes(uid)) return systemRoleSchema.enum.jrAdmin;
  return 'none';
}

export function holdsAdminStanding(roster: AdminList, uid: string): boolean {
  return adminStandingOf(roster, uid) !== 'none';
}
