// Trust & Safety — per-obligation SLA monitors + the global dead-man heartbeat
// (Appendix A §A8, Finding-M1 / Finding-H4 / Finding-H2).
//
// One monitor ROW per distinct obligation (the single `safetySlaMonitor/{caseId}`
// is removed). Most rows are case-scoped — `safetySlaMonitors/{caseId}__{monitorKind}`
// — but the NCII removal deadline is REQUEST-scoped [H4]:
// `safetySlaMonitors/{requestId}__nciiRemovalDeadline`, because each statutory
// request owns its own 48h obligation and a monitor can never be resolved by
// finishing a DIFFERENT linked request. ONE schema covers both shapes (`caseId?`
// and `requestId?` both optional). Arming or resolving one row MUST NOT read or
// write another row (no cross-monitor coupling).
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A8 — no invented values, no
// placeholders.
//
// No cross-cluster foundation enums are consumed here; the monitor enums are
// §A8-specific value sets and live in this file.
//
// Collection note: this cluster introduces ONE NEW Firestore collection
// (`safetySlaMonitors`, two doc-id shapes) plus ONE singleton document
// (`safetyMonitorHeartbeat/global`). Wiring collections.ts / path-builders.ts /
// registry.ts is deferred to the app leg (the orchestrator binds the schemas +
// path builders there); the composite + singleton doc-id shapes are documented on
// each schema below.

import { z } from 'zod';

// ===========================================================================
// A8 — safetySlaMonitors/{caseId}__{monitorKind}
//      AND the request-scoped variant safetySlaMonitors/{requestId}__nciiRemovalDeadline
// One row per distinct obligation. Each fires the external (Sentry / Cloud-
// Monitoring) alarm independently.
// ===========================================================================

/** The distinct obligation kinds. The two FIXED (non-operator-configurable)
 * headline urgent-tab countdowns are `photoDnaContract` (the CSAM 72h match-
 * reporting clock) and `nciiRemovalDeadline` (the NCII 48h statutory removal
 * clock). The rest are internal operational alarms on a CSAM/NCII case, never the
 * headline clock. Clocks + the urgent tab attach ONLY to PhotoDNA-hash detections
 * and cases reported as CSAM or NCII. */
export const SafetySlaMonitorKindSchema = z.enum([
  'reviewDue',
  'photoDnaContract',
  'actualKnowledgeUnreported',
  'ncmecRetry',
  'quarantineStall',
  'evidenceStall',
  'accountActionPending',
  'nciiRemovalDeadline',
]);
export type SafetySlaMonitorKind = z.infer<typeof SafetySlaMonitorKindSchema>;

/** [H2] nciiRemovalDeadline only: `provisional` on first facial-completeness,
 * `binding` once valid. */
export const SafetySlaMonitorStageSchema = z.enum(['provisional', 'binding']);
export type SafetySlaMonitorStage = z.infer<typeof SafetySlaMonitorStageSchema>;

/** Monitor lifecycle status. */
export const SafetySlaMonitorStatusSchema = z.enum(['armed', 'overdue', 'resolved']);
export type SafetySlaMonitorStatus = z.infer<typeof SafetySlaMonitorStatusSchema>;

/** `safetySlaMonitors/{caseId}__{monitorKind}` — per-obligation SLA monitor.
 * The `nciiRemovalDeadline` row is REQUEST-scoped [H4]: its doc id is the
 * composite `{requestId}__nciiRemovalDeadline` and it carries `requestId` (not
 * `caseId`). ONE schema covers both shapes — `caseId?` and `requestId?` are both
 * optional. The case `nciiCases/{caseId}.nciiRemovalDeadlineAt` is a
 * NON-authoritative projection of the minimum active request monitor. */
export const SafetySlaMonitorV1Schema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(), // nciiRemovalDeadline rows are request-scoped [H4]
  monitorKind: SafetySlaMonitorKindSchema,
  armedAt: z.number(),
  deadlineAt: z.number(),
  escalationLevel: z.number(),
  lastFiredAt: z.number().optional(),
  monitorStage: SafetySlaMonitorStageSchema.optional(), // [H2] nciiRemovalDeadline only
  basisSubmissionId: z.string().min(1).optional(), // [H2] the immutable TakeItDownSubmissionV1 whose receivedAt pins this deadline
  status: SafetySlaMonitorStatusSchema,
  resolvedAt: z.number().optional(),
  resolutionBasis: z.string().optional(),
}).strict();
export type SafetySlaMonitorV1 = z.infer<typeof SafetySlaMonitorV1Schema>;

// ===========================================================================
// A8 — safetyMonitorHeartbeat/global (global dead-man monitor; SINGLETON)
// The scheduled monitor sweep stamps `lastRunAt`; a missed heartbeat
// (now − lastRunAt > expectedIntervalMs) self-alarms out-of-band. Removes the old
// per-case `heartbeatAt` — the heartbeat is GLOBAL, not per-case. Doc id is the
// fixed singleton literal `global`.
// ===========================================================================

export const SafetyMonitorHeartbeatV1Schema = z.object({
  schemaVersion: z.literal(1),
  lastRunAt: z.number(),
  expectedIntervalMs: z.number(),
}).strict();
export type SafetyMonitorHeartbeatV1 = z.infer<typeof SafetyMonitorHeartbeatV1Schema>;
