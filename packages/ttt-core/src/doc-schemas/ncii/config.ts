// Trust & Safety — NCII config singletons (Appendix A §A11 [H6] / [H-17] / [H-18]).
//
// Three `_config` singleton documents:
//   - `_config/nciiPolicy`              → NciiPolicyConfigV1
//   - `_config/privilegedReviewerSecurity` → PrivilegedReviewerSecurityProfileV1
//   - `_config/operatorContinuity`      → OperatorContinuityConfigV1
//
// These are VERSIONED launch defaults. Qualified counsel must approve them before
// uploads open and may increase, decrease, or otherwise modify them. Any change
// increments the policy version and triggers a retention/configuration review. The
// launch/config audit FAILS CLOSED if any value is missing or a placeholder;
// uploads stay BLOCKED until `counselApproved` flips true at the pre-launch counsel
// gate.
//
// Every value in the DEFAULT consts below is transcribed verbatim from
// docs/code_changes_needed/trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A11
// [H6] / [H-17] / [H-18] — no invented values, no placeholders. The schemas pin
// each literal-defaulted field where the spec fixes a single literal value
// (`policyVersion`, `approvedBy`, `counselApproved`, the security-profile string
// literals, etc.) so a config write cannot silently drift from the frozen posture.
//
// Collection note: these are `_config` singleton docs; wiring collections.ts /
// path-builders.ts / registry.ts is deferred to the app leg.

import { z } from 'zod';

// ===========================================================================
// §A11 [H6] — NciiPolicyConfigV1 + DEFAULT_NCII_POLICY_CONFIG_V1
// `_config/nciiPolicy`
// ===========================================================================

/** Blocked-hash retention policy — indefinite until an appeal reverses it. */
export const NciiBlockedHashRetentionPolicySchema = z.literal('indefiniteUntilReversed');
export type NciiBlockedHashRetentionPolicy = z.infer<typeof NciiBlockedHashRetentionPolicySchema>;

/** `_config/nciiPolicy` = `NciiPolicyConfigV1` — the DJ-approved launch defaults.
 * Counsel ratifies (`counselApproved`) at the pre-launch gate; uploads stay
 * blocked until then. Any value missing/placeholder → the launch audit FAILS
 * CLOSED. */
export const NciiPolicyConfigV1Schema = z.object({
  policyVersion: z.literal('ncii.2026-06-19.v1'),
  appealWindowDays: z.number(),
  requesterPiiRetentionDays: z.number(),
  evidenceRetentionDays: z.number(),
  statusTokenRetentionDays: z.number(),
  blockedHashRetentionPolicy: NciiBlockedHashRetentionPolicySchema,
  allowedEvidenceMimeTypes: z.array(z.string().min(1)),
  maxEvidenceFileBytes: z.number(),
  maxEvidenceFilesPerRequest: z.number(),
  maxEvidenceTotalBytesPerRequest: z.number(),
  uploadReservationMinutes: z.number(),
  abandonedUploadCleanupHours: z.number(),
  publicRequestsPerIpPerHour: z.number(),
  publicUploadsPerIpPerHour: z.number(),
  requestsPerDevicePerDay: z.number(),
  // [H1/M3] temp-hold + status/supplement token values:
  tempHoldInitialHours: z.number(),
  tempHoldPendingValidityExtensionHours: z.number(),
  tempHoldMaxTotalHours: z.number(),
  incompleteInvalidReleaseDelayHours: z.number(),
  statusTokenEntropyBits: z.number(),
  statusTokenTtlDays: z.number(),
  // [H-07] dedup window for the deterministic initial-intake idempotency key
  idempotencyWindowHours: z.number(),
  // [H-09] per-appeal review SLA for NciiAppealV1.deadlineAt
  uploaderRemovalAppealWindowDays: z.number(),
  // [M-10] evidence parser-hardening budgets (attacker-controlled bytes):
  maxEvidenceDecodePixels: z.number(),
  maxEvidenceImageDimension: z.number(),
  maxEvidenceVideoFrames: z.number(),
  maxEvidenceVideoDurationSec: z.number(),
  evidenceParserTimeoutSec: z.number(),
  evidenceScanCpuBudgetMs: z.number(),
  evidenceScanMemoryBudgetMb: z.number(),
  rejectArchiveAndPolyglotPayloads: z.boolean(),
  approvedBy: z.literal('operatorLaunchDefault'),
  // counselApproved flips true at the pre-launch counsel gate; uploads stay blocked until then
  counselApproved: z.boolean(),
}).strict();
export type NciiPolicyConfigV1 = z.infer<typeof NciiPolicyConfigV1Schema>;

/** The frozen launch default for `_config/nciiPolicy`. */
export const DEFAULT_NCII_POLICY_CONFIG_V1: NciiPolicyConfigV1 = {
  policyVersion: 'ncii.2026-06-19.v1',
  appealWindowDays: 30,
  requesterPiiRetentionDays: 90,
  evidenceRetentionDays: 60,
  statusTokenRetentionDays: 180,
  blockedHashRetentionPolicy: 'indefiniteUntilReversed',
  allowedEvidenceMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
  maxEvidenceFileBytes: 26214400,
  maxEvidenceFilesPerRequest: 5,
  maxEvidenceTotalBytesPerRequest: 104857600,
  uploadReservationMinutes: 30,
  abandonedUploadCleanupHours: 24,
  publicRequestsPerIpPerHour: 5,
  publicUploadsPerIpPerHour: 10,
  requestsPerDevicePerDay: 10,
  tempHoldInitialHours: 72,
  tempHoldPendingValidityExtensionHours: 48,
  tempHoldMaxTotalHours: 336,
  incompleteInvalidReleaseDelayHours: 24,
  statusTokenEntropyBits: 256,
  statusTokenTtlDays: 180,
  idempotencyWindowHours: 72,
  uploaderRemovalAppealWindowDays: 14,
  maxEvidenceDecodePixels: 40000000,
  maxEvidenceImageDimension: 12000,
  maxEvidenceVideoFrames: 600,
  maxEvidenceVideoDurationSec: 600,
  evidenceParserTimeoutSec: 60,
  evidenceScanCpuBudgetMs: 30000,
  evidenceScanMemoryBudgetMb: 512,
  rejectArchiveAndPolyglotPayloads: true,
  approvedBy: 'operatorLaunchDefault',
  counselApproved: false,
};

// ===========================================================================
// §A11 [H-17] — PrivilegedReviewerSecurityProfileV1 +
// DEFAULT_PRIVILEGED_REVIEWER_SECURITY_PROFILE_V1
// `_config/privilegedReviewerSecurity`
//
// "fresh reauth" / "two-step reauth" for ANY privileged-reviewer capability means
// a reauth that satisfies THIS profile — NEVER a bare password re-prompt. Enforced
// even though one solo operator holds every capability at launch.
// ===========================================================================

/** The phishing-resistant second factor — password-only, SMS, and TOTP are NEVER
 * sufficient for a privileged capability. */
export const PrivilegedReviewerSecondFactorSchema = z.literal('passkeyWebAuthn');
export type PrivilegedReviewerSecondFactor = z.infer<typeof PrivilegedReviewerSecondFactorSchema>;

/** The capabilities that require the passkey assertion + an explicit typed
 * confirmation (two-step reauth). */
export const PrivilegedTwoStepReauthCapabilitySchema = z.enum([
  'evidenceReveal',
  'ncmecCredentialUse',
  'reinstateContent',
  'reverseHashBlock',
  'legalDisposition',
  'falsePositiveCorrection',
  'ncmecManualFallback',
]);
export type PrivilegedTwoStepReauthCapability = z.infer<typeof PrivilegedTwoStepReauthCapabilitySchema>;

/** `_config/privilegedReviewerSecurity` = `PrivilegedReviewerSecurityProfileV1` —
 * what "fresh reauth" actually means for any privileged-reviewer capability. */
export const PrivilegedReviewerSecurityProfileV1Schema = z.object({
  // phishing-resistant; password-only, SMS, and TOTP are NEVER sufficient for a privileged capability
  requiredSecondFactor: PrivilegedReviewerSecondFactorSchema,
  // a capability invocation needs a WebAuthn assertion at least this fresh; older → re-prompt
  privilegedReauthTtlSeconds: z.number(),
  // the privileged session is bound to the enrolled authenticator/device; separate from the ordinary app session
  privilegedSessionDeviceBound: z.boolean(),
  // these require the passkey assertion + an explicit typed confirmation
  twoStepReauthCapabilities: z.array(PrivilegedTwoStepReauthCapabilitySchema),
  // offline one-time break-glass codes, generated at enrollment, stored physically offline
  recoveryCodeCount: z.number(),
  // using one is logged, fires the external critical alarm, and forces enrolling a fresh passkey
  recoveryCodeUse: z.literal('auditedHighSeverity+forcesReenroll+criticalAlarm'),
  // lost-device: revoke ALL privileged sessions → forces re-enrollment before any capability works again
  allowPrivilegedSessionRevocation: z.boolean(),
  // each privileged-capability use writes an audit event (actor, capability, caseId, reauth method, before/after for evidence reads)
  everyInvocationAudited: z.boolean(),
}).strict();
export type PrivilegedReviewerSecurityProfileV1 = z.infer<typeof PrivilegedReviewerSecurityProfileV1Schema>;

/** The frozen launch default for `_config/privilegedReviewerSecurity`. */
export const DEFAULT_PRIVILEGED_REVIEWER_SECURITY_PROFILE_V1: PrivilegedReviewerSecurityProfileV1 = {
  requiredSecondFactor: 'passkeyWebAuthn',
  privilegedReauthTtlSeconds: 300,
  privilegedSessionDeviceBound: true,
  twoStepReauthCapabilities: [
    'evidenceReveal',
    'ncmecCredentialUse',
    'reinstateContent',
    'reverseHashBlock',
    'legalDisposition',
    'falsePositiveCorrection',
    'ncmecManualFallback',
  ],
  recoveryCodeCount: 10,
  recoveryCodeUse: 'auditedHighSeverity+forcesReenroll+criticalAlarm',
  allowPrivilegedSessionRevocation: true,
  everyInvocationAudited: true,
};

// ===========================================================================
// §A11 [H-18] — OperatorContinuityConfigV1 + DEFAULT_OPERATOR_CONTINUITY_CONFIG_V1
// `_config/operatorContinuity`
//
// The dead-man heartbeat requires the operator to check in within
// `operatorHeartbeatHours`; a missed heartbeat trips `operatorUnavailableFailsafe`,
// fail-safe by construction.
// ===========================================================================

/** Human-only steps blocked-pending-operator when the failsafe is active. */
export const OperatorBlockedPendingStepSchema = z.enum([
  'ncmecFiling',
  'appealReview',
  'reinstatementReview',
  'leResponse',
]);
export type OperatorBlockedPendingStep = z.infer<typeof OperatorBlockedPendingStepSchema>;

/** A registered backup-human slot: an enrolled passkey + the explicit privileged
 * capabilities they hold + a counsel-confirmed training acknowledgement. EMPTY at
 * launch (solo) — a documented slot to fill post-funding. */
export const OperatorBackupContactV1Schema = z.object({
  contactId: z.string().min(1),
  passkeyEnrolled: z.literal(true),
  // the explicit matrix capabilities this backup holds (SafetyReviewerCapability values)
  capabilities: z.array(z.string().min(1)),
  trainingAcknowledgedAt: z.number(),
  counselConfirmed: z.boolean(),
}).strict();
export type OperatorBackupContactV1 = z.infer<typeof OperatorBackupContactV1Schema>;

/** `_config/operatorContinuity` = `OperatorContinuityConfigV1` — the
 * operator-availability continuity failsafe posture. */
export const OperatorContinuityConfigV1Schema = z.object({
  // max time between operator check-ins before the failsafe trips
  operatorHeartbeatHours: z.number(),
  failsafeDisablesNewUploads: z.boolean(),
  // content stays down, holds stay active, NO evidence release/TTL-reap while active
  failsafeHoldsAllInFlight: z.boolean(),
  blockedPendingOperatorSteps: z.array(OperatorBlockedPendingStepSchema),
  // a passed deadline is logged with breachReason + preserved good-faith record, never silent
  recordDeadlineBreaches: z.boolean(),
  // EMPTY at launch (solo)
  operatorBackupContacts: z.array(OperatorBackupContactV1Schema),
  approvedBy: z.literal('operatorLaunchDefault'),
  // counsel ratifies the continuity posture at the pre-launch gate
  counselApproved: z.boolean(),
}).strict();
export type OperatorContinuityConfigV1 = z.infer<typeof OperatorContinuityConfigV1Schema>;

/** The frozen launch default for `_config/operatorContinuity`. */
export const DEFAULT_OPERATOR_CONTINUITY_CONFIG_V1: OperatorContinuityConfigV1 = {
  operatorHeartbeatHours: 24,
  failsafeDisablesNewUploads: true,
  failsafeHoldsAllInFlight: true,
  blockedPendingOperatorSteps: ['ncmecFiling', 'appealReview', 'reinstatementReview', 'leResponse'],
  recordDeadlineBreaches: true,
  operatorBackupContacts: [],
  approvedBy: 'operatorLaunchDefault',
  counselApproved: false,
};
