// Trust & Safety — NCII config singletons (Appendix A §A11 [H6] / [H-17] / [H-18]).
//
// Two `_config` singleton documents:
//   - `_config/nciiPolicy`              → NciiPolicyConfigV1
//   - `_config/privilegedReviewerSecurity` → PrivilegedReviewerSecurityProfileV1
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
  policyVersion: z.literal('ncii.2026-06-23.v1'),
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
  // [H1/M3] temp-hold + status/supplement token values:
  tempHoldInitialHours: z.number(),
  tempHoldPendingValidityExtensionHours: z.number(),
  tempHoldMaxTotalHours: z.number(),
  incompleteInvalidReleaseDelayHours: z.number(),
  statusTokenEntropyBits: z.number(),
  statusTokenTtlDays: z.number(),
  // [H-07] dedup window for the deterministic initial-intake idempotency key
  idempotencyWindowHours: z.number(),
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
  policyVersion: 'ncii.2026-06-23.v1',
  requesterPiiRetentionDays: 90,
  evidenceRetentionDays: 60,
  statusTokenRetentionDays: 180,
  blockedHashRetentionPolicy: 'indefiniteUntilReversed',
  allowedEvidenceMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
  // [H-01/R10] 100MB per file (was 500MB): the evidence-scan trigger downloads the whole object into a
  // ~512MiB Function before scanning, so an allowed file must fit in memory. Total = 3×100MB = 300MB.
  // Count stays 3. The storage.rules `nciiEvidence` per-file cap mirrors this 100MB (rules can't read
  // this config).
  maxEvidenceFileBytes: 104857600,
  maxEvidenceFilesPerRequest: 3,
  maxEvidenceTotalBytesPerRequest: 314572800,
  uploadReservationMinutes: 30,
  abandonedUploadCleanupHours: 24,
  tempHoldInitialHours: 72,
  tempHoldPendingValidityExtensionHours: 48,
  tempHoldMaxTotalHours: 336,
  incompleteInvalidReleaseDelayHours: 24,
  statusTokenEntropyBits: 256,
  statusTokenTtlDays: 180,
  idempotencyWindowHours: 72,
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
