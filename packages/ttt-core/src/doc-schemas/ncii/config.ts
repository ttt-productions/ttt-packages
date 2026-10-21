// Trust & Safety — NCII config singletons.
//
// Two Admin-SDK-only `_serverData` singleton documents, wired into COLLECTIONS,
// PATH_BUILDERS, and the doc-schema registry:
//   - `_serverData/nciiPolicy`              → NciiPolicyConfigV1
//   - `_serverData/privilegedReviewerSecurity` → PrivilegedReviewerSecurityProfileV1
//
// These are VERSIONED operator launch defaults (`approvedBy: 'operatorLaunchDefault'`);
// a reader falls back to the frozen DEFAULT when the stored doc is absent. Any change
// increments the policy version and triggers a retention/configuration review.
//
// The schemas pin each field that has a single fixed value (`policyVersion`,
// `approvedBy`, the security-profile string literals, etc.) so a config write cannot
// silently drift from the frozen posture.

import { z } from 'zod';

// ===========================================================================
// NciiPolicyConfigV1 + DEFAULT_NCII_POLICY_CONFIG_V1
// `_serverData/nciiPolicy`
// ===========================================================================

/** Blocked-hash retention policy — indefinite until an appeal reverses it. */
export const NciiBlockedHashRetentionPolicySchema = z.literal('indefiniteUntilReversed');
export type NciiBlockedHashRetentionPolicy = z.infer<typeof NciiBlockedHashRetentionPolicySchema>;

/** `_serverData/nciiPolicy` = `NciiPolicyConfigV1` — the operator launch defaults. */
export const NciiPolicyConfigV1Schema = z
  .object({
    policyVersion: z.literal('ncii.2026-06-23.v1'),
    requesterPiiRetentionDays: z.number(),
    evidenceRetentionDays: z.number(),
    blockedHashRetentionPolicy: NciiBlockedHashRetentionPolicySchema,
    allowedEvidenceMimeTypes: z.array(z.string().min(1)),
    maxEvidenceFileBytes: z.number(),
    maxEvidenceFilesPerRequest: z.number(),
    maxEvidenceTotalBytesPerRequest: z.number(),
    uploadReservationMinutes: z.number(),
    abandonedUploadCleanupHours: z.number(),
    // temp-hold values:
    tempHoldInitialHours: z.number(),
    tempHoldPendingValidityExtensionHours: z.number(),
    tempHoldMaxTotalHours: z.number(),
    incompleteInvalidReleaseDelayHours: z.number(),
    // Intake route rate limit — OPERATIONAL operator defaults, not legal-retention values. The public
    // intake route returns 429 + Retry-After and NEVER discards a submission. App-Check is the PRIMARY
    // defense with only a GENEROUS per-IP burst backstop (generous enough not to throttle a real
    // VPN/shared-IP victim; the evidence BYTES path carries no per-IP limit — this is the HTTP route
    // only).
    intakeRateLimitWindowSeconds: z.number(),
    intakeRateLimitMaxPerIp: z.number(),
    // dedup window for the deterministic initial-intake idempotency key
    idempotencyWindowHours: z.number(),
    // evidence parser-hardening budgets (attacker-controlled bytes):
    maxEvidenceDecodePixels: z.number(),
    maxEvidenceImageDimension: z.number(),
    maxEvidenceVideoFrames: z.number(),
    maxEvidenceVideoDurationSec: z.number(),
    evidenceParserTimeoutSec: z.number(),
    evidenceScanCpuBudgetMs: z.number(),
    evidenceScanMemoryBudgetMb: z.number(),
    rejectArchiveAndPolyglotPayloads: z.boolean(),
    approvedBy: z.literal('operatorLaunchDefault'),
  })
  .strict();
export type NciiPolicyConfigV1 = z.infer<typeof NciiPolicyConfigV1Schema>;

/**
 * The largest single evidence file a take-it-down request may attach: the evidence-scan trigger
 * downloads the whole object into a ~512 MiB Function before scanning, so an allowed file must fit
 * in memory. storage.rules restates this per-file cap because rules cannot import TypeScript; the
 * app's storage-rules cap test fails on a mismatch.
 */
export const NCII_EVIDENCE_MAX_FILE_BYTES = 100 * 1024 * 1024;

/** The most evidence files one take-it-down request may attach. */
export const NCII_EVIDENCE_MAX_FILES_PER_REQUEST = 3;

/** The frozen launch default for `_serverData/nciiPolicy`. */
export const DEFAULT_NCII_POLICY_CONFIG_V1: NciiPolicyConfigV1 = {
  policyVersion: 'ncii.2026-06-23.v1',
  requesterPiiRetentionDays: 90,
  evidenceRetentionDays: 60,
  blockedHashRetentionPolicy: 'indefiniteUntilReversed',
  allowedEvidenceMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
  ],
  maxEvidenceFileBytes: NCII_EVIDENCE_MAX_FILE_BYTES,
  maxEvidenceFilesPerRequest: NCII_EVIDENCE_MAX_FILES_PER_REQUEST,
  maxEvidenceTotalBytesPerRequest:
    NCII_EVIDENCE_MAX_FILES_PER_REQUEST * NCII_EVIDENCE_MAX_FILE_BYTES,
  uploadReservationMinutes: 30,
  abandonedUploadCleanupHours: 24,
  tempHoldInitialHours: 72,
  tempHoldPendingValidityExtensionHours: 48,
  tempHoldMaxTotalHours: 336,
  incompleteInvalidReleaseDelayHours: 24,
  // intake route rate limit — generous operator defaults
  intakeRateLimitWindowSeconds: 3600, // per source IP (secondary flood guard; App-Check is primary)
  intakeRateLimitMaxPerIp: 20, // generous so a shared/VPN IP with several genuine victims isn't throttled
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
};

// ===========================================================================
// PrivilegedReviewerSecurityProfileV1 +
// DEFAULT_PRIVILEGED_REVIEWER_SECURITY_PROFILE_V1
// `_serverData/privilegedReviewerSecurity`
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
export type PrivilegedTwoStepReauthCapability = z.infer<
  typeof PrivilegedTwoStepReauthCapabilitySchema
>;

/** `_serverData/privilegedReviewerSecurity` = `PrivilegedReviewerSecurityProfileV1` —
 * what "fresh reauth" actually means for any privileged-reviewer capability. */
export const PrivilegedReviewerSecurityProfileV1Schema = z
  .object({
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
  })
  .strict();
export type PrivilegedReviewerSecurityProfileV1 = z.infer<
  typeof PrivilegedReviewerSecurityProfileV1Schema
>;

/** The frozen launch default for `_serverData/privilegedReviewerSecurity`. */
export const DEFAULT_PRIVILEGED_REVIEWER_SECURITY_PROFILE_V1: PrivilegedReviewerSecurityProfileV1 =
  {
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
