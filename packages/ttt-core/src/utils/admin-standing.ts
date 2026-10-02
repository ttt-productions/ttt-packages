// The ONE reading of admin standing from the `_systemData/adminList` roster. Standing is roster
// membership — full admin or jrAdmin. Whether a role currently authorizes anything is the backend's
// authority check, never decided here.

import type { AdminList } from '../doc-schemas/system.js';
import { systemRoleSchema, type SystemRole } from '../schemas/atoms.js';

/** A uid's standing on the roster: its system role, or `'none'` when it is on neither list. */
export type AdminStanding = SystemRole | 'none';

function uidsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * The roster held by an `_systemData/adminList` document's data. The stored doc is untrusted, so a
 * missing doc, a non-object, a list that is not an array, and non-string entries all read as
 * absent rather than throw.
 */
export function adminRosterOf(data: unknown): AdminList {
  const record = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return { admins: uidsOf(record.admins), jrAdmins: uidsOf(record.jrAdmins) };
}

/** A uid's standing: `'admin'` when on `admins` (even if also on `jrAdmins`), else `'jrAdmin'`, else `'none'`. */
export function adminStandingOf(roster: AdminList, uid: string): AdminStanding {
  if (roster.admins.includes(uid)) return systemRoleSchema.enum.admin;
  if (roster.jrAdmins.includes(uid)) return systemRoleSchema.enum.jrAdmin;
  return 'none';
}

/** Whether a uid holds admin standing — full admin or jrAdmin — on the roster. */
export function holdsAdminStanding(roster: AdminList, uid: string): boolean {
  return adminStandingOf(roster, uid) !== 'none';
}
