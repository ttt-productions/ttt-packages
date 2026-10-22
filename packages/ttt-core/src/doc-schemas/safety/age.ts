import { z } from 'zod';
import { RegistrationCompletionOutcomeSchema } from './foundation.js';

export const AgeBracketSchema = z.enum(['teen', 'adult']);
export type AgeBracket = z.infer<typeof AgeBracketSchema>;

export const AgeAttestationNonceStatusSchema = z.enum(['issued', 'consumed', 'expired']);
export type AgeAttestationNonceStatus = z.infer<typeof AgeAttestationNonceStatusSchema>;

export const AgeAttestationNonceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    bracket: AgeBracketSchema,
    policyVersion: z.string().min(1),
    signingKeyVersion: z.string().min(1),
    requestSessionHash: z.string().min(1),
    issuedAt: z.number(),
    expiresAt: z.number(),
    consumedAt: z.number().optional(),
    consumedByUid: z.string().min(1).optional(),
    status: AgeAttestationNonceStatusSchema,
    ttlExpireAt: z.unknown().optional(),
  })
  .strict();
export type AgeAttestationNonceV1 = z.infer<typeof AgeAttestationNonceV1Schema>;

export const AgeBracketAttestationClaimsV1Schema = z
  .object({
    iss: z.string().min(1),
    aud: z.string().min(1),
    sub: z.string().min(1),
    iat: z.number().int(),
    exp: z.number().int(),
    bkt: AgeBracketSchema,
    pv: z.string().min(1),
    rsh: z.string().min(1),
  })
  .strict();
export type AgeBracketAttestationClaimsV1 = z.infer<typeof AgeBracketAttestationClaimsV1Schema>;

export const AgePolicyConfigV1Schema = z
  .object({
    agePolicyVersion: z.string().min(1),
    registrationGracePeriodMinutes: z.number().int(),
    cleanupSchedule: z.string().min(1),
    ageTokenTtlSeconds: z.number().int(),
    keyRetirementVerificationMinutes: z.number().int(),
  })
  .strict();
export type AgePolicyConfigV1 = z.infer<typeof AgePolicyConfigV1Schema>;

export const DEFAULT_AGE_POLICY_CONFIG_V1: AgePolicyConfigV1 = {
  agePolicyVersion: '2026-06-19.general-audience.v1',
  registrationGracePeriodMinutes: 30,
  cleanupSchedule: '*/15 * * * *',
  ageTokenTtlSeconds: 600,
  keyRetirementVerificationMinutes: 15,
};

export const AgeUpgradeAttestationV1Schema = z
  .object({
    uid: z.string().min(1),
    accountCapabilityVersion: z.number().int(),
    policyVersion: z.string().min(1),
    issuedAt: z.number(),
    expiresAt: z.number(),
    nonce: z.string().min(1),
  })
  .strict();
export type AgeUpgradeAttestationV1 = z.infer<typeof AgeUpgradeAttestationV1Schema>;

export const UserPrivateDataAgeManualCorrectionSchema = z
  .object({
    at: z.number(),
    actorId: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();
export type UserPrivateDataAgeManualCorrection = z.infer<
  typeof UserPrivateDataAgeManualCorrectionSchema
>;

export const UserPrivateDataAgeFieldsSchema = z
  .object({
    accountType: AgeBracketSchema,
    is18Plus: z.boolean(),
    agePolicyVersion: z.string().min(1),
    accountCapabilityVersion: z.number().int(),
    ageAttestedAt: z.number(),
    adultUpgradedAt: z.number().optional(),
    ageManualCorrection: UserPrivateDataAgeManualCorrectionSchema.optional(),
    attestedDateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    attestedDobRecordedAt: z.number().optional(),
    attestedDobSource: z.enum(['artisanOnboarding']).optional(),
  })
  .strict();
export type UserPrivateDataAgeFields = z.infer<typeof UserPrivateDataAgeFieldsSchema>;

export const userPrivateDataAgeFieldsShape = {
  accountType: AgeBracketSchema,
  is18Plus: z.boolean(),
  agePolicyVersion: z.string().min(1),
  accountCapabilityVersion: z.number().int(),
  ageAttestedAt: z.number(),
  adultUpgradedAt: z.number().optional(),
  ageManualCorrection: UserPrivateDataAgeManualCorrectionSchema.optional(),
  attestedDateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  attestedDobRecordedAt: z.number().optional(),
  attestedDobSource: z.enum(['artisanOnboarding']).optional(),
} as const;

export const RegistrationCompletionResultV1Schema = z
  .object({
    outcome: RegistrationCompletionOutcomeSchema,
    uid: z.string().min(1).optional(),
  })
  .strict();
export type RegistrationCompletionResultV1 = z.infer<typeof RegistrationCompletionResultV1Schema>;
