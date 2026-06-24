// activeSafetyCaseAlerts/{caseId} — the time-sensitive admin "case needs work" pin.
//
// A PII-free, NON-dismissable pointer that lights the 5th notification-tray tab
// (admins only). One row exists while a protected case is open and needs operator
// attention; it is written at protected-case creation (CSAM `openChildSafetyCase`
// + NCII `openNciiCaseFromReport` / the public take-it-down intake converge on ONE
// shared helper) and DELETED by a Cloud Function when the case is resolved on the
// Safety Case Console (worked, or marked a false report).
//
// It deliberately carries NO content and NO countdown — the Safety Case Console
// page owns every detail; the mere EXISTENCE of a row is the alert. There is no
// client archive/clear callable for this collection, so the tray's Clear All
// (which only ever touches `activeAdminNotifications`) can never dismiss these.
//
// Cross-boundary: Cloud Functions write it (Admin SDK) and the frontend tray reads
// it (admin-only `onSnapshot`), so the shape lives in ttt-core.

import { z } from 'zod';

/** Which protected-case kind this alert points at. EXTENSIBLE — a future
 *  time-sensitive admin category adds a value here, never a parallel collection. */
export const SafetyCaseAlertKindSchema = z.enum(['childSafety', 'ncii']);
export type SafetyCaseAlertKind = z.infer<typeof SafetyCaseAlertKindSchema>;

/** `activeSafetyCaseAlerts/{caseId}` — bound in ../registry.ts. */
export const SafetyCaseAlertV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1), // the childSafetyCases / nciiCases doc id this alert points at
  caseKind: SafetyCaseAlertKindSchema,
  createdAt: z.number(),
}).strict();
export type SafetyCaseAlertV1 = z.infer<typeof SafetyCaseAlertV1Schema>;
